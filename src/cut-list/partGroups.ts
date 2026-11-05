import type { CutListItem } from '../domain/cutlist/deriveCutList'

const groups = [
  { id: 'bases', title: 'Cabinet bases' },
  { id: 'shelves', title: 'Shelves and dividers' },
  { id: 'doors', title: 'Doors' },
  { id: 'drawers', title: 'Drawers' },
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
    .map(({ id, title }) => {
      const rows = items.filter((item) => partGroup[item.part] === id)
      return { id, title, items: id === 'drawers' ? inDrawerOrder(rows) : rows }
    })
    .filter((group) => group.items.length > 0)
}
