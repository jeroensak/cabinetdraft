import type { ProjectSettings } from '../project/types'
import type { CabinetModule } from './types'

/** Canonical outside-to-interior construction dimensions, in millimetres. */
export function deriveCarcassDimensions(
  module: CabinetModule,
  settings: ProjectSettings,
) {
  const thickness = settings.corpusThickness
  return {
    internalWidth: module.width - 2 * thickness,
    carcassDepth:
      module.depth -
      (settings.backPanelEnabled ? settings.backPanelThickness : 0),
    interiorBottom: thickness,
    interiorTop: module.height - thickness,
  }
}
