import type { CabinetModule } from './types'
import type { ProjectSettings } from '../project/types'
import type { PhysicalPanel } from '../geometry/physicalPanel'

export interface CabinetGeometry {
  internalWidth: number
  carcassDepth: number
  interiorBottom: number
  interiorTop: number
  panels: PhysicalPanel[]
}

/** Canonical carcass and shelf geometry. Does not repair invalid dimensions.
 * Front panels are deliberately outside this derivation.
 */
export function deriveCabinetGeometry(
  module: CabinetModule,
  settings: ProjectSettings,
): CabinetGeometry {
  const thickness = settings.corpusThickness
  const internalWidth = module.width - 2 * thickness
  const carcassDepth =
    module.depth - (settings.backPanelEnabled ? settings.backPanelThickness : 0)
  const interiorBottom = thickness
  const interiorTop = module.height - thickness

  const horizontalPanel = (
    source: PhysicalPanel['source'],
    bottom: number,
  ): PhysicalPanel => ({
    moduleId: module.id,
    source,
    length: internalWidth,
    width: carcassDepth,
    thickness,
    orientation: 'horizontal',
    position: { x: thickness, y: bottom, z: 0 },
  })

  const panels: PhysicalPanel[] = [
    ...(['side-left', 'side-right'] as const).map((type): PhysicalPanel => ({
      moduleId: module.id,
      source: { type },
      length: module.height,
      width: carcassDepth,
      thickness,
      orientation: 'side',
      position: {
        x: type === 'side-left' ? 0 : module.width - thickness,
        y: 0,
        z: 0,
      },
    })),
    horizontalPanel({ type: 'top' }, interiorTop),
    horizontalPanel({ type: 'bottom' }, 0),
    ...[...module.shelves]
      .sort((a, b) => a.bottom - b.bottom)
      .map((shelf) =>
        horizontalPanel({ type: 'shelf', shelfId: shelf.id }, shelf.bottom),
      ),
  ]

  if (settings.backPanelEnabled) {
    panels.push({
      moduleId: module.id,
      source: { type: 'back' },
      length: module.height,
      width: module.width,
      thickness: settings.backPanelThickness,
      orientation: 'face',
      position: { x: 0, y: 0, z: carcassDepth },
    })
  }

  return { internalWidth, carcassDepth, interiorBottom, interiorTop, panels }
}
