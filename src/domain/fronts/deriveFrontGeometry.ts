import {
  horizontalBounds,
  leftBoundary,
  rightBoundary,
} from '../spaces/boundaries'
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
  | { code: 'missing-front-divider'; dividerId: string }
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
  const h = horizontalBounds(module, settings, front)
  for (const boundary of [leftBoundary(front), rightBoundary(front)]) {
    if (
      boundary.type === 'divider' &&
      !module.dividers.some((d) => d.id === boundary.dividerId)
    )
      issues.push({
        ...context,
        code: 'missing-front-divider',
        dividerId: boundary.dividerId,
      })
  }
  if (!Number.isFinite(h.left) || !Number.isFinite(h.right))
    return { panels: [], issues }
  const left =
    leftBoundary(front).type === 'module-left'
      ? gap
      : h.left - settings.corpusThickness / 2 + gap / 2
  const right =
    rightBoundary(front).type === 'module-right'
      ? module.width - gap
      : h.right + settings.corpusThickness / 2 - gap / 2
  const doubleDoor = front.type === 'door' && front.leaves === 2
  const width = doubleDoor ? (right - left - gap) / 2 : right - left
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
        panel({ type: 'door', frontId: front.id, leaf: 'left' }, left),
        panel(
          { type: 'door', frontId: front.id, leaf: 'right' },
          left + width + gap,
        ),
      ]
    : [
        panel(
          front.type === 'door'
            ? { type: 'door', frontId: front.id, leaf: 'single' }
            : { type: 'drawer', frontId: front.id },
          left,
        ),
      ]

  return { panels, issues }
}
