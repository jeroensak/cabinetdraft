import { describe, expect, it } from 'vitest'
import { addDoor, addDrawerFront, setDoorLeaves, removeFront } from './fronts'
import {
  fixture,
  freeze,
  fullRange,
  ids,
  rejects,
  structuralCodes,
} from './testHelpers'
import { validateProject } from '../validation/validateProject'

describe('front commands', () => {
  it.each([1, 2] as const)(
    'adds one semantic %s-leaf door over a contiguous multi-space range',
    (leaves) => {
      const project = fixture()
      project.modules[0]!.fronts = []
      const next = addDoor(
        freeze(project),
        project.modules[0]!.id,
        freeze(fullRange),
        leaves,
        ids(),
      )
      expect(next.modules[0]!.fronts).toStrictEqual([
        { id: 'new-1', type: 'door', leaves, ...fullRange },
      ])
      expect(validateProject(next)).toStrictEqual([])
    },
  )

  it('adds a drawer to exactly one selected space and does not retain caller boundary references', () => {
    const project = fixture()
    const module = project.modules[0]!
    module.fronts = []
    const range = {
      bottomBoundary: { type: 'module-bottom' as const },
      topBoundary: { type: 'shelf' as const, shelfId: module.shelves[0]!.id },
    }
    const next = addDrawerFront(freeze(project), module.id, range, ids())
    range.topBoundary.shelfId = 'changed'
    expect(next.modules[0]!.fronts[0]).toStrictEqual({
      id: 'new-1',
      type: 'drawer',
      bottomBoundary: { type: 'module-bottom' },
      topBoundary: { type: 'shelf', shelfId: module.shelves[0]!.id },
    })
    expect(validateProject(next)).toStrictEqual([])
  })

  it('rejects overlapping door or drawer assignments', () => {
    const project = fixture()
    const module = project.modules[0]!
    const range = {
      ...fullRange,
      topBoundary: { type: 'shelf' as const, shelfId: module.shelves[0]!.id },
    }
    rejects(
      project,
      () => addDoor(project, module.id, range, 1, ids()),
      'structural-conflict',
    )
    expect(
      structuralCodes(() => addDrawerFront(project, module.id, range, ids())),
    ).toContain('overlapping-fronts')
  })

  it('rejects drawer ranges spanning multiple spaces', () => {
    const project = fixture()
    project.modules[0]!.fronts = []
    expect(
      structuralCodes(() =>
        addDrawerFront(
          freeze(project),
          project.modules[0]!.id,
          fullRange,
          ids(),
        ),
      ),
    ).toContain('drawer-must-cover-one-space')
  })

  it('rejects missing, reversed, and zero-length boundary ranges', () => {
    const project = fixture(true)
    const module = project.modules[0]!
    for (const range of [
      {
        ...fullRange,
        topBoundary: { type: 'shelf' as const, shelfId: 'missing' },
      },
      {
        bottomBoundary: fullRange.topBoundary,
        topBoundary: fullRange.bottomBoundary,
      },
      {
        bottomBoundary: fullRange.bottomBoundary,
        topBoundary: fullRange.bottomBoundary,
      },
    ])
      rejects(
        project,
        () => addDoor(project, module.id, range, 1, ids()),
        'structural-conflict',
      )
  })

  it('changes leaves without replacing the front or silently rounding an invalid width', () => {
    const project = addDoor(fixture(true), 'original-2', fullRange, 1, ids())
    project.modules[0]!.width = 801
    const next = setDoorLeaves(freeze(project), 'original-2', 'new-1', 2)
    expect(next.modules[0]!.fronts[0]).toStrictEqual({
      ...project.modules[0]!.fronts[0],
      leaves: 2,
    })
    expect(validateProject(next).map((issue) => issue.code)).toContain(
      'fractional-front-dimension',
    )
  })

  it('removes only the requested front', () => {
    const project = fixture()
    const module = project.modules[0]!
    const next = removeFront(freeze(project), module.id, module.fronts[0]!.id)
    expect(next.modules[0]!.fronts).toStrictEqual([])
    expect(next.modules[0]!.shelves).toStrictEqual(module.shelves)
  })

  it('rejects invalid leaf counts, drawers, and unknown front IDs', () => {
    const project = addDrawerFront(
      fixture(true),
      'original-2',
      fullRange,
      ids(),
    )
    rejects(
      project,
      () => setDoorLeaves(project, 'original-2', 'new-1', 2),
      'not-a-door',
    )
    rejects(
      project,
      () => setDoorLeaves(project, 'original-2', 'missing', 2),
      'front-not-found',
    )
    rejects(
      project,
      () => removeFront(project, 'original-2', 'missing'),
      'front-not-found',
    )
    rejects(
      project,
      () => addDoor(project, 'original-2', fullRange, 3 as 1, ids()),
      'invalid-leaves',
    )
  })
})
