import { beforeAll, describe, expect, it } from 'vitest'
import type { CutListItem } from '../domain/cutlist/deriveCutList'
import { cutListRows, groupCutList } from './partGroups'
import { setLanguage } from '../i18n'
import { deriveRowBanding } from '../domain/cutlist/edgeBanding'
import { bandedEdgesLabel, partName } from './partNames'

// These read the English names, whatever language the machine runs in.
beforeAll(() => setLanguage('en'))

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

describe('cutListRows', () => {
  const sized = (
    id: string,
    part: CutListItem['part'],
    moduleId: string,
    length = 100,
  ) => ({ ...item(id, part, moduleId), length })

  it('merges identical parts across cabinets and keeps every ID', () => {
    const rows = cutListRows(
      [
        sized('C1-SIDE-L', 'side-left', 'one'),
        sized('C1-SIDE-R', 'side-right', 'one'),
        sized('C2-SIDE-L', 'side-left', 'two'),
        sized('C3-SIDE-L', 'side-left', 'three', 200),
      ],
      'mm',
      true,
    )
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      ids: ['C1-SIDE-L', 'C1-SIDE-R', 'C2-SIDE-L'],
      cabinets: ['one', 'two'],
      quantity: 3,
    })
    expect(rows[1]).toMatchObject({ ids: ['C3-SIDE-L'], quantity: 1 })
  })

  it('treats left and right drawer sides as one part only when merged', () => {
    const sides = [
      sized('D-L', 'drawer-side-left', 'one'),
      sized('D-R', 'drawer-side-right', 'one'),
    ]
    expect(cutListRows(sides, 'mm', true)).toHaveLength(1)
    expect(cutListRows(sides, 'mm', true)[0]!.name).toBe('Drawer side')
    expect(cutListRows(sides, 'mm', false)).toHaveLength(2)
  })

  it('treats a top and bottom as one part only when merged', () => {
    const parts = [sized('T', 'top', 'one'), sized('B', 'bottom', 'one')]
    expect(cutListRows(parts, 'mm', true)).toHaveLength(1)
    expect(cutListRows(parts, 'mm', true)[0]).toMatchObject({
      ids: ['T', 'B'],
      name: 'Top / bottom',
      quantity: 2,
    })
    expect(cutListRows(parts, 'mm', false)).toHaveLength(2)
  })

  it('keeps different parts of the same size apart', () => {
    const parts = [sized('S', 'shelf', 'one'), sized('D', 'divider', 'one')]
    expect(cutListRows(parts, 'mm', true)).toHaveLength(2)
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

  it('keeps what a merged row needs for its banding', () => {
    const [row] = cutListRows(
      [
        { ...item('C1-DRAWER-1', 'drawer'), waveDip: 15 },
        { ...item('C2-DRAWER-1', 'drawer', 'two'), waveDip: 15 },
      ],
      'mm',
      true,
    )
    expect(row).toMatchObject({ part: 'drawer', waveDip: 15, quantity: 2 })
    expect(bandedEdgesLabel(row!)).toBe('All 4 edges +25%')
    expect(deriveRowBanding(row!).length).toBe(375 * 2)
  })

  it('never merges a part with a differently banded one', () => {
    const rows = cutListRows(
      [
        item('C1-DRAWER-1', 'drawer'),
        { ...item('C1-DRAWER-2', 'drawer'), waveDip: 15 },
        item('C1-DRAWER-1-BOX-FRONT', 'drawer-box-front'),
      ],
      'mm',
      true,
    )
    expect(rows.map(bandedEdgesLabel)).toStrictEqual([
      'All 4 edges',
      'All 4 edges +25%',
      'None',
    ])
  })
})
