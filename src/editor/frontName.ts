import type { Front } from '../domain/fronts/types'
export function frontName(front: Front) {
  return front.type === 'drawer'
    ? 'Drawer front'
    : front.leaves === 2
      ? 'Double door'
      : 'Single door'
}
