import type { CutListItem } from '../domain/cutlist/deriveCutList'

export const partNames: Record<CutListItem['part'], string> = {
  'side-left': 'Side',
  'side-right': 'Side',
  top: 'Top',
  bottom: 'Bottom',
  shelf: 'Shelf',
  back: 'Back',
  door: 'Door',
  drawer: 'Drawer front',
}
