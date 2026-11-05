import type { CabinetModule } from './types'
import type { ProjectSettings } from '../project/types'
import type { PhysicalPanel } from '../geometry/physicalPanel'
import { horizontalBounds, verticalBounds } from '../spaces/boundaries'
import { insetDoorSetback } from '../fronts/insetDoorSetback'
import { deriveCarcassDimensions } from './deriveCarcassDimensions'

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
  const { internalWidth, carcassDepth, interiorBottom, interiorTop } =
    deriveCarcassDimensions(module, settings)

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
        x: type === 'side-left' ? 0 : thickness + internalWidth,
        y: 0,
        z: 0,
      },
    })),
    horizontalPanel({ type: 'top' }, interiorTop),
    horizontalPanel({ type: 'bottom' }, 0),
    ...[...module.shelves]
      .sort((a, b) => a.bottom - b.bottom)
      .map((shelf) => {
        const bounds = horizontalBounds(module, settings, shelf)
        const panel = horizontalPanel(
          { type: 'shelf', shelfId: shelf.id },
          shelf.bottom,
        )
        const setback = insetDoorSetback(module, settings, {
          ...bounds,
          bottom: shelf.bottom,
          top: shelf.bottom + thickness,
        })
        return {
          ...panel,
          length: bounds.right - bounds.left,
          width: carcassDepth - setback,
          position: { ...panel.position, x: bounds.left, z: setback },
        }
      }),
    ...module.dividers
      .flatMap((divider): PhysicalPanel[] => {
        const space = verticalBounds(module, settings, divider)
        const setback = insetDoorSetback(module, settings, {
          left: divider.left,
          right: divider.left + thickness,
          bottom: space.bottom,
          top: space.top,
        })
        return [
          {
            moduleId: module.id,
            source: { type: 'divider', dividerId: divider.id },
            length: space.top - space.bottom,
            width: carcassDepth - setback,
            thickness,
            orientation: 'side',
            position: { x: divider.left, y: space.bottom, z: setback },
          },
        ]
      })
      .sort(
        (a, b) => a.position.y - b.position.y || a.position.x - b.position.x,
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
