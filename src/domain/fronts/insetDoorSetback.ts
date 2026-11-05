import type { CabinetModule } from '../cabinet/types'
import type { ProjectSettings } from '../project/types'
import { horizontalBounds, verticalBounds } from '../spaces/boundaries'

interface PanelBox {
  left: number
  right: number
  bottom: number
  top: number
}

/** How far a shelf or divider sits back from the carcass front. An inset door
 * fills the first part of its opening, so anything inside that opening moves
 * behind the door and keeps the front gap as clearance. Panels bounding the
 * opening only touch its edges and stay where they are. */
export function insetDoorSetback(
  module: CabinetModule,
  settings: ProjectSettings,
  panel: PanelBox,
): number {
  const behindInsetDoor = module.fronts.some((front) => {
    if (front.type !== 'door' || front.mount !== 'inset') return false
    const horizontal = horizontalBounds(module, settings, front)
    const vertical = verticalBounds(module, settings, front)
    return (
      panel.left < horizontal.right &&
      panel.right > horizontal.left &&
      panel.bottom < vertical.top &&
      panel.top > vertical.bottom
    )
  })
  return behindInsetDoor ? settings.frontThickness + settings.frontGap : 0
}
