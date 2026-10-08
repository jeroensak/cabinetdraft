import type { CabinetModule } from '../cabinet/types'
import { deriveCabinetGeometry } from '../cabinet/deriveCabinetGeometry'
import type { Boundary } from '../fronts/types'
import type { ProjectSettings } from '../project/types'

/** Free interior region, derived from structural boundaries; never persisted. */
export interface Space {
  bottomBoundary: Boundary
  topBoundary: Boundary
  bottom: number
  top: number
  height: number
}

/** Bottom-to-top spaces. Invalid/overlapping shelves retain their raw geometry. */
export function deriveSpaces(
  module: CabinetModule,
  settings: ProjectSettings,
): Space[] {
  const geometry = deriveCabinetGeometry(module, settings)
  const spaces: Space[] = []
  let bottom = geometry.interiorBottom
  let bottomBoundary: Boundary = { type: 'module-bottom' }

  for (const panel of geometry.panels) {
    if (panel.source.type !== 'shelf') continue
    const top = panel.position.y
    const topBoundary: Boundary = {
      type: 'shelf',
      shelfId: panel.source.shelfId,
    }
    spaces.push({
      bottomBoundary,
      topBoundary,
      bottom,
      top,
      height: top - bottom,
    })
    bottom = top + panel.thickness
    bottomBoundary = { ...topBoundary }
  }

  spaces.push({
    bottomBoundary,
    topBoundary: { type: 'module-top' },
    bottom,
    top: geometry.interiorTop,
    height: geometry.interiorTop - bottom,
  })
  return spaces
}
