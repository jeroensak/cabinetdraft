import { describe, expect, it } from 'vitest'
import { deriveCabinetGeometry } from '../cabinet/deriveCabinetGeometry'
import { deriveCutList } from '../cutlist/deriveCutList'
import { exportProject, parseProject } from '../import-export/projectJson'
import { sameBoundary } from '../spaces/boundaries'
import type { CabinetModule } from '../cabinet/types'
import type { ProjectSettings } from '../project/types'
import type { SpaceRange } from '../fronts/types'
import { deriveSpaces } from '../spaces/deriveSpaces'
import { validateProject } from '../validation/validateProject'
import { addShelfToSpace, removeShelf } from './shelves'
import { moveShelf } from './shelves'
import {
  duplicateModule,
  setModuleDimensions,
  updateProjectSettings,
} from './modules'
import { addDividerToSpace, moveDivider, removeDivider } from './dividers'
import { fixture, freeze, rejects } from './testHelpers'

function spacesInBand(
  module: CabinetModule,
  settings: ProjectSettings,
  range: SpaceRange,
) {
  return deriveSpaces(module, settings).filter(
    (space) =>
      sameBoundary(space.bottomBoundary, range.bottomBoundary) &&
      sameBoundary(space.topBoundary, range.topBoundary),
  )
}
function firstSlot(project: ReturnType<typeof fixture>) {
  const module = project.modules[0]!
  return spacesInBand(
    module,
    project.settings,
    deriveSpaces(module, project.settings)[0]!,
  )[0]!
}

describe('space-level vertical dividers', () => {
  it('places one panel at the centre of the chosen opening and uses it in the cut list', () => {
    const project = fixture()
    const before = structuredClone(project)
    const module = project.modules[0]!
    const next = addDividerToSpace(
      freeze(project),
      module.id,
      firstSlot(project),
      () => 'divider-1',
    )
    expect(project).toStrictEqual(before)
    expect(next.modules[0]!.dividers).toStrictEqual([
      {
        id: 'divider-1',
        left: 391,
        bottomBoundary: { type: 'module-bottom' },
        topBoundary: { type: 'shelf', shelfId: module.shelves[0]!.id },
      },
    ])
    const panel = deriveCabinetGeometry(
      next.modules[0]!,
      next.settings,
    ).panels.find((item) => item.source.type === 'divider')!
    expect(panel).toStrictEqual({
      moduleId: module.id,
      source: { type: 'divider', dividerId: 'divider-1' },
      length: 1073,
      width: 597,
      thickness: 18,
      orientation: 'side',
      position: { x: 391, y: 18, z: 0 },
    })
    const slots = spacesInBand(
      next.modules[0]!,
      next.settings,
      deriveSpaces(next.modules[0]!, next.settings)[0]!,
    )
    expect(
      slots.map((slot) => [slot.left, slot.right, slot.width]),
    ).toStrictEqual([
      [18, 391, 373],
      [409, 782, 373],
    ])
    const list = deriveCutList(next)
    expect(list.available).toBe(true)
    if (!list.available) return
    expect(list.items.find((item) => item.id === 'C1-DIVIDER-1')).toMatchObject(
      {
        part: 'divider',
        length: 1073,
        width: 597,
        thickness: 18,
      },
    )
    expect(validateProject(next)).toStrictEqual([])
    expect(
      list.items
        .filter((item) => item.part === 'door')
        .map((item) => item.width),
    ).toStrictEqual([397, 397])
  })

  it('splits the selected slot again and remaps shelf references on duplication', () => {
    const initial = fixture()
    const moduleId = initial.modules[0]!.id
    const first = addDividerToSpace(
      initial,
      moduleId,
      firstSlot(initial),
      () => 'divider-1',
    )
    const second = addDividerToSpace(
      first,
      moduleId,
      firstSlot(first),
      () => 'divider-2',
    )
    expect(
      second.modules[0]!.dividers.map((divider) => divider.left),
    ).toStrictEqual([391, 196])
    expect(
      spacesInBand(
        second.modules[0]!,
        second.settings,
        deriveSpaces(second.modules[0]!, second.settings)[0]!,
      ).map((slot) => slot.width),
    ).toStrictEqual([178, 177, 373])
    let next = 0
    const duplicate = duplicateModule(second, moduleId, () => `copy-${++next}`)
    const copy = duplicate.modules[1]!
    expect(copy.dividers).toHaveLength(2)
    expect(copy.dividers.map((divider) => divider.id)).toStrictEqual([
      'copy-4',
      'copy-5',
    ])
    expect(copy.dividers[0]!.topBoundary).toStrictEqual({
      type: 'shelf',
      shelfId: 'copy-2',
    })
    expect(validateProject(duplicate)).toStrictEqual([])
    const list = deriveCutList(second)
    expect(list.available).toBe(true)
    if (!list.available) return
    expect(
      list.items
        .filter((item) => item.part === 'divider')
        .map((item) => item.id),
    ).toStrictEqual(['C1-DIVIDER-1', 'C1-DIVIDER-2'])
    expect(
      list.items
        .filter((item) => item.part === 'divider')
        .map((item) => item.length),
    ).toStrictEqual([1073, 1073])
  })

  it('can split the right slot and a different vertical space independently', () => {
    const initial = fixture()
    const moduleId = initial.modules[0]!.id
    const first = addDividerToSpace(
      initial,
      moduleId,
      firstSlot(initial),
      () => 'lower-left',
    )
    const lowerSpace = deriveSpaces(first.modules[0]!, first.settings)[0]!
    const rightSlot = spacesInBand(
      first.modules[0]!,
      first.settings,
      lowerSpace,
    )[1]!
    const second = addDividerToSpace(
      first,
      moduleId,
      rightSlot,
      () => 'lower-right',
    )
    const upperSpace = deriveSpaces(second.modules[0]!, second.settings).at(-1)!
    const upperSlot = spacesInBand(
      second.modules[0]!,
      second.settings,
      upperSpace,
    )[0]!
    const third = addDividerToSpace(second, moduleId, upperSlot, () => 'upper')
    expect(
      third.modules[0]!.dividers.map((divider) => divider.left),
    ).toStrictEqual([391, 587, 391])
    expect(
      spacesInBand(third.modules[0]!, third.settings, lowerSpace).map(
        (slot) => slot.width,
      ),
    ).toStrictEqual([373, 178, 177])
    expect(
      spacesInBand(third.modules[0]!, third.settings, upperSpace).map(
        (slot) => slot.width,
      ),
    ).toStrictEqual([373, 373])
    const rows = deriveCutList(third)
    expect(rows.available).toBe(true)
    if (!rows.available) return
    expect(
      rows.items
        .filter((item) => item.part === 'divider')
        .map((item) => item.id),
    ).toStrictEqual(['C1-DIVIDER-1', 'C1-DIVIDER-2', 'C1-DIVIDER-3'])
  })

  it('preserves invalid divider positions for repair and blocks all manufacturing rows', () => {
    const original = fixture()
    const moduleId = original.modules[0]!.id
    const added = addDividerToSpace(
      original,
      moduleId,
      firstSlot(original),
      () => 'divider-1',
    )
    const moved = moveDivider(added, moduleId, 'divider-1', 17)
    expect(moved.modules[0]!.dividers[0]!.left).toBe(17)
    expect(validateProject(moved).map((issue) => issue.code)).toContain(
      'invalid-slot-width',
    )
    expect(deriveCutList(moved).available).toBe(false)
    expect(parseProject(exportProject(moved))).toStrictEqual(moved)
    const repaired = moveDivider(moved, moduleId, 'divider-1', 400)
    expect(validateProject(repaired)).toStrictEqual([])
    rejects(
      repaired,
      () => moveDivider(repaired, moduleId, 'divider-1', 400.5),
      'invalid-integer',
    )
  })

  it('protects shelves that support dividers and rejects stale or too narrow slots', () => {
    const initial = fixture()
    const moduleId = initial.modules[0]!.id
    const first = firstSlot(initial)
    const added = addDividerToSpace(initial, moduleId, first, () => 'divider-1')
    rejects(
      added,
      () => addShelfToSpace(added, moduleId, first),
      'invalid-space',
    )
    rejects(
      added,
      () => removeShelf(added, moduleId, initial.modules[0]!.shelves[0]!.id),
      'shelf-has-dividers',
    )
    rejects(
      added,
      () => addDividerToSpace(added, moduleId, first),
      'invalid-slot',
    )
    const removed = removeDivider(added, moduleId, 'divider-1')
    expect(removed.modules[0]!.dividers).toStrictEqual([])
    expect(validateProject(removed)).toStrictEqual([])
    expect(
      addShelfToSpace(removed, moduleId, first).modules[0]!.shelves,
    ).toHaveLength(2)
    const narrow = fixture()
    narrow.modules[0]!.width = 55
    narrow.modules[0]!.fronts = []
    rejects(
      narrow,
      () => addDividerToSpace(narrow, narrow.modules[0]!.id, firstSlot(narrow)),
      'slot-too-narrow',
    )
  })

  it('follows changed shelf height, outside width and back setting without stale dimensions', () => {
    const initial = fixture()
    const moduleId = initial.modules[0]!.id
    const added = addDividerToSpace(
      initial,
      moduleId,
      firstSlot(initial),
      () => 'divider-1',
    )
    const movedShelf = moveShelf(
      added,
      moduleId,
      initial.modules[0]!.shelves[0]!.id,
      900,
    )
    const resized = setModuleDimensions(movedShelf, moduleId, {
      width: 900,
      depth: 500,
    })
    const noBack = updateProjectSettings(resized, { backPanelEnabled: false })
    const divider = deriveCabinetGeometry(
      noBack.modules[0]!,
      noBack.settings,
    ).panels.find((panel) => panel.source.type === 'divider')!
    expect(divider).toMatchObject({
      length: 882,
      width: 500,
      thickness: 18,
      position: { x: 391, y: 18, z: 0 },
    })
    expect(
      spacesInBand(
        noBack.modules[0]!,
        noBack.settings,
        deriveSpaces(noBack.modules[0]!, noBack.settings)[0]!,
      ).map((slot) => slot.width),
    ).toStrictEqual([373, 473])
    expect(validateProject(noBack)).toStrictEqual([])
  })
})
