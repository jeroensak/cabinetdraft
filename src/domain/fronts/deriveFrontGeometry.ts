import type { CabinetModule } from '../cabinet/types'
import type { PhysicalPanel } from '../geometry/physicalPanel'
import type { ProjectSettings } from '../project/types'
import { resolveFrontBoundary } from './resolveFrontBoundary'
import type { Front } from './types'

type Dimension = 'length' | 'width' | 'thickness'

export type FrontGeometryIssue = {
  moduleId: string
  frontId: string
} & (
  | { code: 'missing-front-boundary'; edge: 'bottom' | 'top'; shelfId: string }
  | {
      code: 'fractional-front-dimension' | 'invalid-front-dimension'
      dimension: Dimension
      value: number
    }
)

export interface FrontGeometry {
  /** Raw geometry, even when dimensions are invalid; never silently rounded. */
  panels: PhysicalPanel[]
  /** Geometry issues only; project-wide structural validation is separate. */
  issues: FrontGeometryIssue[]
}

/** Canonical physical panels for one semantic door or drawer front.
 * Overlay fronts sit in front of the carcass (negative z), with their rear at z=0.
 * This is geometry derivation, not authorization of a front's structural range.
 */
export function deriveFrontGeometry(
  module: CabinetModule,
  settings: ProjectSettings,
  front: Front,
): FrontGeometry {
  const issues: FrontGeometryIssue[] = []
  const context = { moduleId: module.id, frontId: front.id }
  const bottom = resolveFrontBoundary(
    front.bottomBoundary,
    'bottom',
    module,
    settings,
  )
  const top = resolveFrontBoundary(front.topBoundary, 'top', module, settings)

  for (const edge of ['bottom', 'top'] as const) {
    const boundary =
      edge === 'bottom' ? front.bottomBoundary : front.topBoundary
    const coordinate = edge === 'bottom' ? bottom : top
    if (coordinate === undefined && boundary.type === 'shelf') {
      issues.push({
        ...context,
        code: 'missing-front-boundary',
        edge,
        shelfId: boundary.shelfId,
      })
    }
  }
  if (bottom === undefined || top === undefined) return { panels: [], issues }

  const gap = settings.frontGap
  const doubleDoor = front.type === 'door' && front.leaves === 2
  const width = doubleDoor
    ? (module.width - 3 * gap) / 2
    : module.width - 2 * gap
  const dimensions = {
    length: top - bottom,
    width,
    thickness: settings.frontThickness,
  }

  for (const dimension of ['length', 'width', 'thickness'] as const) {
    const value = dimensions[dimension]
    if (!Number.isFinite(value) || value <= 0) {
      issues.push({
        ...context,
        code: 'invalid-front-dimension',
        dimension,
        value,
      })
    } else if (!Number.isInteger(value)) {
      issues.push({
        ...context,
        code: 'fractional-front-dimension',
        dimension,
        value,
      })
    }
  }

  const panel = (
    source: PhysicalPanel['source'],
    x: number,
  ): PhysicalPanel => ({
    moduleId: module.id,
    source,
    ...dimensions,
    orientation: 'face',
    position: { x, y: bottom, z: -settings.frontThickness },
  })

  const panels = doubleDoor
    ? [
        panel({ type: 'door', frontId: front.id, leaf: 'left' }, gap),
        panel(
          { type: 'door', frontId: front.id, leaf: 'right' },
          gap + width + gap,
        ),
      ]
    : [
        panel(
          front.type === 'door'
            ? { type: 'door', frontId: front.id, leaf: 'single' }
            : { type: 'drawer', frontId: front.id },
          gap,
        ),
      ]

  return { panels, issues }
}
