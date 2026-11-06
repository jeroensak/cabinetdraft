import type { CabinetModule } from '../cabinet/types'
import type { ProjectSettings } from '../project/types'
import type { Front, SpaceRange } from '../fronts/types'
import { deriveSpaces, type Space } from './deriveSpaces'
import {
  horizontalBounds,
  verticalBounds,
  leftBoundary,
  rightBoundary,
  horizontalData,
  sameSpace,
} from './boundaries'

/** Boundary centre-lines tile the cabinet without counting panel thickness as gaps. */
export function rangeBounds(
  module: CabinetModule,
  settings: ProjectSettings,
  range: SpaceRange,
) {
  const h = horizontalBounds(module, settings, range),
    v = verticalBounds(module, settings, range),
    t = settings.corpusThickness
  return {
    left: h.left - (leftBoundary(range).type === 'module-left' ? t : t / 2),
    right: h.right + (rightBoundary(range).type === 'module-right' ? t : t / 2),
    bottom:
      v.bottom - (range.bottomBoundary.type === 'module-bottom' ? t : t / 2),
    top: v.top + (range.topBoundary.type === 'module-top' ? t : t / 2),
  }
}
export function spaceRange(space: SpaceRange): SpaceRange {
  return {
    bottomBoundary: { ...space.bottomBoundary },
    topBoundary: { ...space.topBoundary },
    ...horizontalData(space),
  }
}
/** The fronts covering any of these spaces, each once. */
export function frontsCovering(
  module: CabinetModule,
  settings: ProjectSettings,
  spaces: readonly Space[],
): Front[] {
  return module.fronts.filter((front) =>
    spacesForRange(module, settings, front).some((covered) =>
      spaces.some((space) => sameSpace(space, covered)),
    ),
  )
}

export function spacesForRange(
  module: CabinetModule,
  settings: ProjectSettings,
  range: SpaceRange,
): Space[] {
  const box = rangeBounds(module, settings, range)
  const selected = deriveSpaces(module, settings).filter((s) => {
    const b = rangeBounds(module, settings, s)
    return (
      b.left >= box.left &&
      b.right <= box.right &&
      b.bottom >= box.bottom &&
      b.top <= box.top
    )
  })
  const area = selected.reduce((total, s) => {
    const b = rangeBounds(module, settings, s)
    return total + (b.right - b.left) * (b.top - b.bottom)
  }, 0)
  return selected.length &&
    area === (box.right - box.left) * (box.top - box.bottom)
    ? selected
    : []
}
/** Only a rectangular union of whole neighbouring openings can become one front. */
export function enclosingRange(
  module: CabinetModule,
  settings: ProjectSettings,
  spaces: Space[],
): SpaceRange | null {
  if (!spaces.length) return null
  const entries = spaces.map((s) => ({
    s,
    b: rangeBounds(module, settings, s),
  }))
  const left = entries.reduce((a, b) => (a.b.left <= b.b.left ? a : b)),
    right = entries.reduce((a, b) => (a.b.right >= b.b.right ? a : b))
  const bottom = entries.reduce((a, b) => (a.b.bottom <= b.b.bottom ? a : b)),
    top = entries.reduce((a, b) => (a.b.top >= b.b.top ? a : b))
  const range = spaceRange({
    leftBoundary: leftBoundary(left.s),
    rightBoundary: rightBoundary(right.s),
    bottomBoundary: bottom.s.bottomBoundary,
    topBoundary: top.s.topBoundary,
  })
  const covered = spacesForRange(module, settings, range)
  return covered.length === spaces.length ? range : null
}
