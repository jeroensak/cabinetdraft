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
  const name = partNames[item.part]
  if (item.groove) {
    const { width, depth, fromEdge } = item.groove
    return `${name}, groove ${width} wide × ${depth} deep, ${fromEdge} mm from lower edge`
  }
  return item.waveDip === undefined
    ? name
    : `${name} (wave top, ${item.waveDip} mm dip)`
}
