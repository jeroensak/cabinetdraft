import type { CabinetModule } from '../cabinet/types'
import type { ProjectSettings } from '../project/types'
import type { Boundary } from './types'

/** Front edge coordinate in physical mm, including the configured overlay gap.
 * Missing shelf references remain unresolved rather than falling back to an edge.
 */
export function resolveFrontBoundary(
  boundary: Boundary,
  edge: 'bottom' | 'top',
  module: CabinetModule,
  settings: ProjectSettings,
): number | undefined {
  switch (boundary.type) {
    case 'module-bottom':
      return settings.frontGap
    case 'module-top':
      return module.height - settings.frontGap
    case 'shelf': {
      const shelf = module.shelves.find((item) => item.id === boundary.shelfId)
      if (!shelf) return undefined
      const centre = shelf.bottom + settings.corpusThickness / 2
      return centre + ((edge === 'bottom' ? 1 : -1) * settings.frontGap) / 2
    }
  }
}
