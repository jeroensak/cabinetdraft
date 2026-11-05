import type { CutListItem } from '../domain/cutlist/deriveCutList'

const partNames: Record<CutListItem['part'], string> = {
  'side-left': 'Side',
  'side-right': 'Side',
  top: 'Top',
  bottom: 'Bottom',
  shelf: 'Shelf',
  divider: 'Divider',
  back: 'Back',
  door: 'Door',
  drawer: 'Drawer front',
  'drawer-side-left': 'Drawer side (left)',
  'drawer-side-right': 'Drawer side (right)',
  'drawer-box-front': 'Drawer box front',
  'drawer-box-back': 'Drawer box back',
  'drawer-bottom': 'Drawer bottom',
}

export function partName(item: CutListItem): string {
  return item.waveDip === undefined
    ? partNames[item.part]
    : `${partNames[item.part]} (wave top, ${item.waveDip} mm dip)`
}
