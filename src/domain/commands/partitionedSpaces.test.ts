import { describe, expect, it } from 'vitest'
import { fixture, fullRange, ids, freeze, rejects } from './testHelpers'
import { addDividerToSpace, moveDivider, removeDivider } from './dividers'
import { addShelfToSpace, moveShelf, removeShelf } from './shelves'
import { addDoor } from './fronts'
import { addBoxlessFront } from './testHelpers'
import { duplicateModule } from './modules'
import { deriveSpaces } from '../spaces/deriveSpaces'
import { enclosingRange } from '../spaces/spaceRanges'
import { deriveCabinetGeometry } from '../cabinet/deriveCabinetGeometry'
import { deriveFrontGeometry } from '../fronts/deriveFrontGeometry'
import { deriveCutList } from '../cutlist/deriveCutList'
import { validateProject } from '../validation/validateProject'
import { parseProject, exportProject } from '../import-export/projectJson'
import type { Project } from '../project/types'

const spaces = (p: Project) => deriveSpaces(p.modules[0], p.settings)
function divided() {
  const p = fixture(true)
  return addDividerToSpace(p, p.modules[0].id, fullRange, () => 'divider')
}
function grid() {
  let p = divided()
  const openings = spaces(p)
  p = addShelfToSpace(p, p.modules[0].id, openings[0], () => 'left-shelf')
  return addShelfToSpace(p, p.modules[0].id, openings[1], () => 'right-shelf')
}

describe('two-dimensional spaces', () => {
  it('turns one opening into two and splits only the chosen side with a physical shelf', () => {
    const p = divided(),
      before = structuredClone(p)
    expect(spaces(p).map((s) => [s.left, s.width, s.height])).toEqual([
      [18, 373, 2164],
      [409, 373, 2164],
    ])
    const next = addShelfToSpace(
      freeze(p),
      p.modules[0].id,
      spaces(p)[0],
      () => 'partial',
    )
    expect(p).toEqual(before)
    expect(
      spaces(next).map((s) => [s.left, s.bottom, s.width, s.height]),
    ).toEqual([
      [18, 18, 373, 1073],
      [409, 18, 373, 2164],
      [18, 1109, 373, 1073],
    ])
    expect(
      deriveCabinetGeometry(next.modules[0], next.settings).panels.find(
        (p) => p.source.type === 'shelf',
      ),
    ).toMatchObject({
      length: 373,
      width: 597,
      thickness: 18,
      position: { x: 18, y: 1091, z: 0 },
    })
    expect(validateProject(next)).toEqual([])
    const rows = deriveCutList(next)
    expect(
      rows.available && rows.items.find((row) => row.part === 'shelf'),
    ).toMatchObject({ length: 373, width: 597 })
  })
  it('supports nested dividers and shelves independent of persisted array order', () => {
    let p = grid()
    p = addDividerToSpace(
      p,
      p.modules[0].id,
      spaces(p)[0],
      () => 'nested-divider',
    )
    p = addShelfToSpace(p, p.modules[0].id, spaces(p)[0], () => 'nested-shelf')
    expect(spaces(p)).toHaveLength(6)
    const panel = deriveCabinetGeometry(p.modules[0], p.settings).panels.find(
      (p) => p.source.type === 'shelf' && p.source.shelfId === 'nested-shelf',
    )
    expect(panel).toMatchObject({
      length: 178,
      position: { x: 18, y: 546, z: 0 },
    })
    expect(validateProject(p)).toEqual([])
    const original = spaces(p)
    p.modules[0].shelves.reverse()
    p.modules[0].dividers.reverse()
    expect(spaces(p)).toEqual(original)
    expect(parseProject(exportProject(p))).toEqual(p)
  })
  it('gives neighbouring fronts a shared gap and lets a door span vertically or horizontally', () => {
    const p = grid(),
      m = p.modules[0]
    let drawers = addBoxlessFront(p, m.id, spaces(p)[0], () => 'left-drawer')
    drawers = addBoxlessFront(drawers, m.id, spaces(p)[1], () => 'right-drawer')
    const panels = drawers.modules[0].fronts.flatMap(
      (f) =>
        deriveFrontGeometry(drawers.modules[0], drawers.settings, f).panels,
    )
    expect(panels.map((p) => [p.position.x, p.width, p.length])).toEqual([
      [2, 397, 1097],
      [401, 397, 1097],
    ])
    expect(validateProject(drawers)).toEqual([])
    const left = spaces(p).filter((s) => s.left === 18)
    const vertical = addDoor(
      p,
      m.id,
      enclosingRange(m, p.settings, left)!,
      1,
      () => 'vertical',
    )
    expect(
      deriveFrontGeometry(
        vertical.modules[0],
        p.settings,
        vertical.modules[0].fronts[0],
      ).panels[0],
    ).toMatchObject({ width: 397, length: 2196, position: { x: 2, y: 2 } })
    const bottom = spaces(p).filter((s) => s.bottom === 18)
    const horizontal = addDoor(
      p,
      m.id,
      enclosingRange(m, p.settings, bottom)!,
      1,
      () => 'horizontal',
    )
    expect(
      deriveFrontGeometry(
        horizontal.modules[0],
        p.settings,
        horizontal.modules[0].fronts[0],
      ).panels[0],
    ).toMatchObject({ width: 796, length: 1097 })
    expect(validateProject(vertical)).toEqual([])
    expect(validateProject(horizontal)).toEqual([])
    expect(enclosingRange(m, p.settings, [...left, spaces(p)[1]])).toBeNull()
    expect(() => addDoor(drawers, m.id, fullRange)).toThrow(
      'structural-conflict',
    )
  })
  it('splits a drawer on either axis and merges only the affected column when a shelf is removed', () => {
    let p = fixture(true)
    const m = p.modules[0]
    p = addBoxlessFront(p, m.id, fullRange, () => 'original-drawer')
    p = addDividerToSpace(p, m.id, fullRange, ids())
    expect(p.modules[0].fronts).toHaveLength(2)
    const right = structuredClone(p.modules[0].fronts[1])
    p = addShelfToSpace(
      p,
      m.id,
      spaces(p)[0],
      (() => {
        let i = 0
        return () => `split-${++i}`
      })(),
    )
    expect(p.modules[0].fronts).toHaveLength(3)
    expect(validateProject(p)).toEqual([])
    p = removeShelf(p, m.id, 'split-1')
    expect(p.modules[0].fronts).toHaveLength(2)
    expect(p.modules[0].fronts).toContainEqual(right)
    expect(validateProject(p)).toEqual([])
  })
  it('remaps every divider and shelf reference when duplicated, and persists no derived rectangles', () => {
    let p = grid()
    p = addDoor(p, p.modules[0].id, spaces(p)[0], 1, () => 'scoped-door')
    const next = duplicateModule(p, p.modules[0].id, ids())
    expect(validateProject(next)).toEqual([])
    const copy = next.modules[1],
      originalIds = new Set(
        [...p.modules[0].shelves, ...p.modules[0].dividers].map((p) => p.id),
      )
    for (const item of [...copy.shelves, ...copy.fronts])
      for (const b of [item.leftBoundary, item.rightBoundary])
        if (b?.type === 'divider')
          expect(originalIds.has(b.dividerId)).toBe(false)
    for (const d of copy.dividers)
      for (const b of [d.bottomBoundary, d.topBoundary])
        if (b.type === 'shelf') expect(originalIds.has(b.shelfId)).toBe(false)
    expect(parseProject(exportProject(next))).toEqual(next)
    const saved = JSON.parse(exportProject(next))
    expect(Object.keys(saved.modules[0].shelves[0]).sort()).toEqual([
      'bottom',
      'id',
      'rightBoundary',
    ])
    expect(saved.modules[0]).not.toHaveProperty('spaces')
  })
  it('retains invalid positions and fractional front sizes, and protects references', () => {
    const p = grid(),
      m = p.modules[0]
    rejects(p, () => removeDivider(p, m.id, 'divider'), 'divider-in-use')
    const moved = moveDivider(p, m.id, 'divider', 10)
    expect(moved.modules[0].dividers[0].left).toBe(10)
    expect(deriveCutList(moved).available).toBe(false)
    expect(parseProject(exportProject(moved))).toEqual(moved)
    const badShelf = moveShelf(p, m.id, 'left-shelf', 2300)
    expect(deriveCutList(badShelf).available).toBe(false)
    const double = addDoor(p, m.id, spaces(p)[0], 2)
    expect(validateProject(double).map((i) => i.code)).toContain(
      'fractional-front-dimension',
    )
    expect(deriveCutList(double).available).toBe(false)
  })
  it('strips derived fields from persisted horizontal references and validates nested supports', () => {
    let p = grid()
    p = addDividerToSpace(
      p,
      p.modules[0].id,
      spaces(p)[0],
      () => 'nested-divider',
    )
    const expected = structuredClone(p)
    Object.assign(p.modules[0].shelves[0].rightBoundary!, {
      coordinate: 391,
      spaces: ['derived'],
    })
    expect(parseProject(exportProject(p))).toEqual(expected)
    const moved = moveDivider(
      expected,
      expected.modules[0].id,
      'nested-divider',
      500,
    )
    expect(validateProject(moved).map((i) => i.code)).toContain(
      'panel-outside-support',
    )
    expect(deriveCutList(moved).available).toBe(false)
    expect(parseProject(exportProject(moved))).toEqual(moved)
  })
  it('migrates V2 dividers intact and rejects missing or cyclic supporting references', () => {
    const p = divided()
    expect(parseProject(JSON.stringify({ ...p, schemaVersion: 2 }))).toEqual(p)
    const broken = grid()
    broken.modules[0].shelves[0].rightBoundary = {
      type: 'divider',
      dividerId: 'missing',
    }
    expect(() => parseProject(JSON.stringify(broken))).toThrow(
      'invalid-structure',
    )
    const cyclic = grid()
    cyclic.modules[0].dividers[0].topBoundary = {
      type: 'shelf',
      shelfId: 'left-shelf',
    }
    expect(() => parseProject(JSON.stringify(cyclic))).toThrow(
      'invalid-structure',
    )
  })
})
