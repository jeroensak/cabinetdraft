import { deriveCarcassDimensions } from '../cabinet/deriveCarcassDimensions'
import type { CabinetModule } from '../cabinet/types'
import type {
  Boundary,
  HorizontalBoundary,
  HorizontalRange,
  SpaceRange,
} from '../fronts/types'
import type { ProjectSettings } from '../project/types'

export const sameBoundary = (a: Boundary, b: Boundary) =>
  a.type === b.type &&
  (a.type !== 'shelf' || (b.type === 'shelf' && a.shelfId === b.shelfId))
export const sameHorizontalBoundary = (
  a: HorizontalBoundary,
  b: HorizontalBoundary,
) =>
  a.type === b.type &&
  (a.type !== 'divider' ||
    (b.type === 'divider' && a.dividerId === b.dividerId))
export const leftBoundary = (range: HorizontalRange): HorizontalBoundary =>
  range.leftBoundary ?? { type: 'module-left' }
export const rightBoundary = (range: HorizontalRange): HorizontalBoundary =>
  range.rightBoundary ?? { type: 'module-right' }
export const sameHorizontalRange = (a: HorizontalRange, b: HorizontalRange) =>
  sameHorizontalBoundary(leftBoundary(a), leftBoundary(b)) &&
  sameHorizontalBoundary(rightBoundary(a), rightBoundary(b))
export const sameSpace = (a: SpaceRange, b: SpaceRange) =>
  sameHorizontalRange(a, b) &&
  sameBoundary(a.bottomBoundary, b.bottomBoundary) &&
  sameBoundary(a.topBoundary, b.topBoundary)
export function copyHorizontalRange(range: HorizontalRange): HorizontalRange {
  return {
    ...(range.leftBoundary ? { leftBoundary: { ...range.leftBoundary } } : {}),
    ...(range.rightBoundary
      ? { rightBoundary: { ...range.rightBoundary } }
      : {}),
  }
}
function horizontalBoundaryData(
  boundary: HorizontalBoundary,
): HorizontalBoundary {
  return boundary.type === 'divider'
    ? { type: 'divider', dividerId: boundary.dividerId }
    : { type: boundary.type }
}
/** Store only non-default horizontal references; no derived dimensions. */
export function horizontalData(range: HorizontalRange): HorizontalRange {
  return {
    ...(leftBoundary(range).type !== 'module-left'
      ? { leftBoundary: horizontalBoundaryData(leftBoundary(range)) }
      : {}),
    ...(rightBoundary(range).type !== 'module-right'
      ? { rightBoundary: horizontalBoundaryData(rightBoundary(range)) }
      : {}),
  }
}
export function horizontalBounds(
  module: CabinetModule,
  settings: ProjectSettings,
  range: HorizontalRange,
) {
  const { internalWidth } = deriveCarcassDimensions(module, settings)
  const resolve = (boundary: HorizontalBoundary, edge: 'left' | 'right') => {
    if (boundary.type === 'module-left') return settings.corpusThickness
    if (boundary.type === 'module-right')
      return settings.corpusThickness + internalWidth
    const divider = module.dividers.find((d) => d.id === boundary.dividerId)
    return divider
      ? divider.left + (edge === 'left' ? settings.corpusThickness : 0)
      : NaN
  }
  return {
    left: resolve(leftBoundary(range), 'left'),
    right: resolve(rightBoundary(range), 'right'),
  }
}
export function verticalBounds(
  module: CabinetModule,
  settings: ProjectSettings,
  range: Pick<SpaceRange, 'bottomBoundary' | 'topBoundary'>,
) {
  const { interiorBottom, interiorTop } = deriveCarcassDimensions(
    module,
    settings,
  )
  const resolve = (boundary: Boundary, edge: 'bottom' | 'top') => {
    if (boundary.type === 'module-bottom') return interiorBottom
    if (boundary.type === 'module-top') return interiorTop
    const shelf = module.shelves.find((s) => s.id === boundary.shelfId)
    return shelf
      ? shelf.bottom + (edge === 'bottom' ? settings.corpusThickness : 0)
      : NaN
  }
  return {
    bottom: resolve(range.bottomBoundary, 'bottom'),
    top: resolve(range.topBoundary, 'top'),
  }
}
