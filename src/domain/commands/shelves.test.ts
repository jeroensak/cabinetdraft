import { describe, expect, it } from 'vitest'
import type { Front } from '../fronts/types'
import { deriveSpaces } from '../spaces/deriveSpaces'
import { validateProject } from '../validation/validateProject'
import { addShelfToSpace, moveShelf, removeShelf } from './shelves'
import {
  fixture,
  freeze,
  fullRange,
  ids,
  rejects,
  structuralCodes,
} from './testHelpers'

function splitFixture(type: 'empty' | 'door' | 'drawer') {
  const project = fixture(true)
  project.modules[0]!.height = 1036 // 1000 free mm, minus an 18 mm shelf.
  if (type === 'door')
    project.modules[0]!.fronts = [
      { id: 'door', type: 'door', leaves: 2, ...fullRange },
    ]
  if (type === 'drawer')
    project.modules[0]!.fronts = [
      { id: 'drawer', type: 'drawer', ...fullRange },
    ]
  return project
}

describe('shelf insertion', () => {
  it.each(['empty', 'door', 'drawer'] as const)(
    'centres a shelf in a selected %s space',
    (type) => {
      const project = splitFixture(type)
      const next = addShelfToSpace(
        freeze(project),
        'original-2',
        fullRange,
        ids(),
      )
      const module = next.modules[0]!
      expect(module.shelves).toStrictEqual([{ id: 'new-1', bottom: 509 }])
      expect(
        deriveSpaces(module, next.settings).map((space) => space.height),
      ).toStrictEqual([491, 491])
      if (type === 'empty') expect(module.fronts).toStrictEqual([])
      if (type === 'door')
        expect(module.fronts).toStrictEqual(project.modules[0]!.fronts)
      if (type === 'drawer')
        expect(module.fronts).toStrictEqual([
          {
            id: 'new-2',
            type: 'drawer',
            bottomBoundary: { type: 'module-bottom' },
            topBoundary: { type: 'shelf', shelfId: 'new-1' },
          },
          {
            id: 'new-3',
            type: 'drawer',
            bottomBoundary: { type: 'shelf', shelfId: 'new-1' },
            topBoundary: { type: 'module-top' },
          },
        ])
      expect(validateProject(next)).toStrictEqual([])
      expect(project.modules[0]!.shelves).toStrictEqual([])
    },
  )

  it('splits the selected smaller space, not the largest space, using current geometry', () => {
    const project = fixture(true)
    project.modules[0]!.shelves = [{ id: 'existing', bottom: 1036 }]
    const selected = deriveSpaces(project.modules[0]!, project.settings)[0]!
    // A caller may hold stale numeric coordinates; structural boundaries are authoritative.
    selected.bottom = 9999
    selected.height = 1
    const next = addShelfToSpace(freeze(project), 'original-2', selected, ids())
    expect(next.modules[0]!.shelves).toStrictEqual([
      { id: 'existing', bottom: 1036 },
      { id: 'new-1', bottom: 518 },
    ])
    expect(
      deriveSpaces(next.modules[0]!, next.settings).map(
        (space) => space.height,
      ),
    ).toStrictEqual([500, 500, 1128])
  })

  it('rejects stale or non-adjacent space boundaries', () => {
    const project = fixture()
    rejects(
      project,
      () => addShelfToSpace(project, 'original-2', fullRange, ids()),
      'invalid-space',
    )
    rejects(
      project,
      () =>
        addShelfToSpace(
          project,
          'original-2',
          { ...fullRange, topBoundary: { type: 'shelf', shelfId: 'missing' } },
          ids(),
        ),
      'invalid-space',
    )
  })

  it('rejects half-millimetre centring rather than inventing a rounding policy', () => {
    const project = fixture()
    const space = deriveSpaces(project.modules[0]!, project.settings)[0]!
    rejects(
      project,
      () => addShelfToSpace(project, 'original-2', space, ids()),
      'non-integer-shelf-position',
    )
  })

  it('rolls back a drawer split if ID generation conflicts partway through', () => {
    const project = splitFixture('drawer')
    const allocated = ['shelf-new', 'drawer-new', 'drawer']
    rejects(
      project,
      () =>
        addShelfToSpace(project, 'original-2', fullRange, () =>
          allocated.shift()!,
        ),
      'id-conflict',
    )
  })
})

describe('shelf movement', () => {
  it('moves only the requested shelf and retains out-of-bounds positions', () => {
    const project = fixture()
    project.modules[0]!.shelves.push({ id: 'upper', bottom: 1700 })
    const next = moveShelf(freeze(project), 'original-2', 'original-3', -100)
    expect(next.modules[0]!.shelves).toStrictEqual([
      { id: 'original-3', bottom: -100 },
      { id: 'upper', bottom: 1700 },
    ])
    expect(next.modules[0]!.fronts).toStrictEqual(project.modules[0]!.fronts)
    expect(validateProject(next).map((issue) => issue.code)).toContain(
      'shelf-outside-interior',
    )
  })

  it('allows geometric shelf overlap without silently snapping', () => {
    const project = fixture()
    project.modules[0]!.shelves.push({ id: 'upper', bottom: 1700 })
    const next = moveShelf(freeze(project), 'original-2', 'original-3', 1695)
    expect(next.modules[0]!.shelves[0]!.bottom).toBe(1695)
    expect(validateProject(next).map((issue) => issue.code)).toContain(
      'invalid-space-height',
    )
  })

  it('rejects movement that turns a drawer into a multi-space front', () => {
    const project = fixture(true)
    const module = project.modules[0]!
    module.shelves = [
      { id: 'low', bottom: 500 },
      { id: 'high', bottom: 1500 },
    ]
    module.fronts = [
      {
        id: 'drawer',
        type: 'drawer',
        bottomBoundary: { type: 'module-bottom' },
        topBoundary: { type: 'shelf', shelfId: 'low' },
      },
    ]
    freeze(project)
    expect(
      structuralCodes(() => moveShelf(project, module.id, 'low', 1600)),
    ).toContain('drawer-must-cover-one-space')
    expect(module.shelves[0]!.bottom).toBe(500)
  })

  it('rejects unknown shelves and fractional stored positions', () => {
    const project = fixture()
    rejects(
      project,
      () => moveShelf(project, 'original-2', 'missing', 500),
      'shelf-not-found',
    )
    rejects(
      project,
      () => removeShelf(project, 'original-2', 'missing'),
      'shelf-not-found',
    )
    rejects(
      project,
      () => moveShelf(project, 'original-2', 'original-3', 500.5),
      'invalid-integer',
    )
  })
})

describe('shelf removal', () => {
  const kinds = ['empty', 'door', 'drawer'] as const
  const cases = kinds.flatMap((lower) =>
    kinds.map((upper) => [lower, upper] as const),
  )
  it.each(cases)(
    'merges lower %s and upper %s using front-over-empty then lower-wins',
    (lower, upper) => {
      const project = fixture()
      const module = project.modules[0]!
      const boundary = {
        type: 'shelf' as const,
        shelfId: module.shelves[0]!.id,
      }
      const front = (
        type: 'door' | 'drawer',
        id: string,
        bottomBoundary: Front['bottomBoundary'],
        topBoundary: Front['topBoundary'],
      ): Front =>
        type === 'door'
          ? { id, type, leaves: 2, bottomBoundary, topBoundary }
          : { id, type, bottomBoundary, topBoundary }
      module.fronts = [
        ...(lower === 'empty'
          ? []
          : [front(lower, 'lower', fullRange.bottomBoundary, boundary)]),
        ...(upper === 'empty'
          ? []
          : [front(upper, 'upper', boundary, fullRange.topBoundary)]),
      ]
      const original = structuredClone(project)
      const next = removeShelf(freeze(project), module.id, boundary.shelfId)
      expect(next.modules[0]!.shelves).toStrictEqual([])
      const winnerType = lower !== 'empty' ? lower : upper
      const winnerId = lower !== 'empty' ? 'lower' : 'upper'
      expect(next.modules[0]!.fronts).toStrictEqual(
        winnerType === 'empty'
          ? []
          : [
              front(
                winnerType,
                winnerId,
                fullRange.bottomBoundary,
                fullRange.topBoundary,
              ),
            ],
      )
      expect(validateProject(next)).toStrictEqual([])
      expect(project).toStrictEqual(original)
    },
  )

  it('keeps the same spanning door unchanged', () => {
    const project = fixture()
    const next = removeShelf(freeze(project), 'original-2', 'original-3')
    expect(next.modules[0]!.fronts).toStrictEqual(project.modules[0]!.fronts)
    expect(validateProject(next)).toStrictEqual([])
  })

  it('preserves the winning door range beyond the merged spaces', () => {
    const project = fixture(true)
    const module = project.modules[0]!
    module.shelves = [
      { id: 'low', bottom: 500 },
      { id: 'high', bottom: 1500 },
    ]
    module.fronts = [
      {
        id: 'winner',
        type: 'door',
        leaves: 1,
        bottomBoundary: { type: 'module-bottom' },
        topBoundary: { type: 'shelf', shelfId: 'high' },
      },
      {
        id: 'loser',
        type: 'drawer',
        bottomBoundary: { type: 'shelf', shelfId: 'high' },
        topBoundary: { type: 'module-top' },
      },
    ]
    const next = removeShelf(freeze(project), module.id, 'high')
    expect(next.modules[0]!.fronts).toStrictEqual([
      { id: 'winner', type: 'door', leaves: 1, ...fullRange },
    ])
    expect(next.modules[0]!.shelves).toStrictEqual([{ id: 'low', bottom: 500 }])
    expect(validateProject(next)).toStrictEqual([])
  })

  it('removes the entire losing spanning door without expanding a winning drawer past one merged space', () => {
    const project = fixture(true)
    const module = project.modules[0]!
    module.shelves = [
      { id: 'low', bottom: 500 },
      { id: 'high', bottom: 1500 },
    ]
    module.fronts = [
      {
        id: 'winner',
        type: 'drawer',
        bottomBoundary: { type: 'module-bottom' },
        topBoundary: { type: 'shelf', shelfId: 'low' },
      },
      {
        id: 'loser',
        type: 'door',
        leaves: 2,
        bottomBoundary: { type: 'shelf', shelfId: 'low' },
        topBoundary: { type: 'module-top' },
      },
    ]
    const next = removeShelf(freeze(project), module.id, 'low')
    expect(next.modules[0]!.fronts).toStrictEqual([
      {
        id: 'winner',
        type: 'drawer',
        bottomBoundary: { type: 'module-bottom' },
        topBoundary: { type: 'shelf', shelfId: 'high' },
      },
    ])
    expect(validateProject(next)).toStrictEqual([])
  })
})
