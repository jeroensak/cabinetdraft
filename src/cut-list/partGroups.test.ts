import { describe, expect, it } from 'vitest'
import type { CutListItem } from '../domain/cutlist/deriveCutList'
import { groupCutList } from './partGroups'
import { partName } from './partNames'

const item = (
  id: string,
  part: CutListItem['part'],
  moduleId = 'one',
): CutListItem => ({
  id,
  moduleId,
  moduleName: moduleId,
  part,
  quantity: 1,
  length: 100,
  width: 50,
  thickness: 18,
})

describe('partName', () => {
  it('spells out the groove on drawer walls', () => {
    expect(
      partName({
        ...item('C1-DRAWER-1-SIDE-L', 'drawer-side-left'),
        groove: { depth: 7.5, width: 6, fromEdge: 13 },
      }),
    ).toBe(
      'Drawer side (left), groove 6 wide × 7.5 deep, 13 mm from lower edge',
    )
  })
})

describe('groupCutList', () => {
  it('orders the four parts lists and keeps every row exactly once', () => {
    const items = [
      item('C1-SIDE-L', 'side-left'),
      item('C1-BACK', 'back'),
      item('C1-SHELF-1', 'shelf'),
      item('C1-DIVIDER-1', 'divider'),
      item('C1-DOOR-1', 'door'),
      item('C1-DRAWER-1-BOTTOM', 'drawer-bottom'),
      item('C1-DRAWER-1', 'drawer'),
    ]
    const groups = groupCutList(items)
    expect(groups.map((group) => group.title)).toStrictEqual([
      'Cabinet bases',
      'Shelves and dividers',
      'Doors',
      'Drawers',
    ])
    expect(
      groups.flatMap((group) => group.items.map((row) => row.id)).sort(),
    ).toStrictEqual(items.map((row) => row.id).sort())
  })

  it('leaves out lists without parts', () => {
    expect(
      groupCutList([item('C1-TOP', 'top')]).map((group) => group.id),
    ).toStrictEqual(['bases'])
    expect(groupCutList([])).toStrictEqual([])
  })

  it('keeps each drawer together, front first, in cabinet order', () => {
    const rows = groupCutList([
      item('C2-DRAWER-1-SIDE-L', 'drawer-side-left', 'two'),
      item('C1-DRAWER-2-SIDE-L', 'drawer-side-left'),
      item('C1-DRAWER-1-SIDE-L', 'drawer-side-left'),
      item('C1-DRAWER-1-SIDE-R', 'drawer-side-right'),
      item('C2-DRAWER-1', 'drawer', 'two'),
      item('C1-DRAWER-1', 'drawer'),
      item('C1-DRAWER-2', 'drawer'),
    ])[0]!.items.map((row) => row.id)
    expect(rows).toStrictEqual([
      'C2-DRAWER-1',
      'C2-DRAWER-1-SIDE-L',
      'C1-DRAWER-1',
      'C1-DRAWER-1-SIDE-L',
      'C1-DRAWER-1-SIDE-R',
      'C1-DRAWER-2',
      'C1-DRAWER-2-SIDE-L',
    ])
  })
})
