import type { CutListItem } from '../domain/cutlist/deriveCutList'
import type { MeasurementUnit } from '../domain/project/units'
import { t } from '../i18n'
import { partName } from './partNames'

const groups = [
  { id: 'bases', titleKey: 'group.bases' },
  { id: 'shelves', titleKey: 'group.shelves' },
  { id: 'doors', titleKey: 'group.doors' },
  { id: 'drawers', titleKey: 'group.drawers' },
] as const

type GroupId = (typeof groups)[number]['id']

const partGroup: Record<CutListItem['part'], GroupId> = {
  'side-left': 'bases',
  'side-right': 'bases',
  top: 'bases',
  bottom: 'bases',
  back: 'bases',
  shelf: 'shelves',
  divider: 'shelves',
  door: 'doors',
  drawer: 'drawers',
  'drawer-side-left': 'drawers',
  'drawer-side-right': 'drawers',
  'drawer-box-front': 'drawers',
  'drawer-box-back': 'drawers',
  'drawer-bottom': 'drawers',
}

const drawerNumber = (item: CutListItem) =>
  Number(/-DRAWER-(\d+)/.exec(item.id)?.[1] ?? 0)

/** Presentation order only: the rows themselves stay the canonical domain rows.
 * Each drawer's parts stay together, its front first, in cabinet order. */
function inDrawerOrder(items: CutListItem[]) {
  const moduleOrder = [...new Set(items.map((item) => item.moduleId))]
  return items.toSorted(
    (a, b) =>
      moduleOrder.indexOf(a.moduleId) - moduleOrder.indexOf(b.moduleId) ||
      drawerNumber(a) - drawerNumber(b) ||
      Number(b.part === 'drawer') - Number(a.part === 'drawer'),
  )
}

export function groupCutList(items: CutListItem[]) {
  return groups
    .map(({ id, titleKey }) => {
      const rows = items.filter((item) => partGroup[item.part] === id)
      return {
        id,
        title: t(titleKey),
        items: id === 'drawers' ? inDrawerOrder(rows) : rows,
      }
    })
    .filter((group) => group.items.length > 0)
}

export interface CutListRow {
  ids: string[]
  cabinets: string[]
  moduleId: string
  name: string
  quantity: number
  length: number
  width: number
  thickness: number
}

/** Rows for one list. Merging is presentation only: identical parts share a
 * row with a quantity, and every part keeps its ID there. */
export function cutListRows(
  items: CutListItem[],
  unit: MeasurementUnit,
  merged: boolean,
): CutListRow[] {
  const rows = new Map<string, CutListRow>()
  items.forEach((item, index) => {
    const name = partName(item, unit, merged)
    const key = merged
      ? [name, item.length, item.width, item.thickness].join('|')
      : String(index)
    const row = rows.get(key)
    if (row) {
      row.ids.push(item.id)
      row.quantity += item.quantity
      if (!row.cabinets.includes(item.moduleName))
        row.cabinets.push(item.moduleName)
      return
    }
    rows.set(key, {
      ids: [item.id],
      cabinets: [item.moduleName],
      moduleId: item.moduleId,
      name,
      quantity: item.quantity,
      length: item.length,
      width: item.width,
      thickness: item.thickness,
    })
  })
  return [...rows.values()]
}
