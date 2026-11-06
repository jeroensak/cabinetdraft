import { UNITS_PER_INCH, type MeasurementUnit } from '../project/units'

/** How many equal spaces the inner size can be divided into: every 50%,
 * 33.3%, 25% and 20%. */
const DIVISIONS = [2, 3, 4, 5]

export interface SnapSpan {
  /** Where the inner space starts, from the cabinet's outside. */
  start: number
  /** The inner size of the cabinet along the drag. */
  size: number
  /** Thickness of the panel being placed, and of the others in a division. */
  thickness: number
}

/** Dragging moves in a round step: 10 mm, or 1/4 inch in an inch design. */
export const snapStep = (unit: MeasurementUnit) =>
  unit === 'inch' ? UNITS_PER_INCH / 4 : 10

export interface EqualSpaceGuide {
  position: number
  /** Share of the inner space below or left of the panel, as a whole percent. */
  percent: number
  /** The fewest equal spaces this position belongs to. */
  spaces: number
}

/** Where panels go to divide the inner space into this many equal spaces.
 * Panels take up room, so each space is the inner size less the panels. */
export function divisionPositions(
  { start, size, thickness }: SnapSpan,
  spaces: number,
): number[] {
  const space = (size - (spaces - 1) * thickness) / spaces
  return Array.from({ length: spaces - 1 }, (_, index) =>
    Math.round(start + (index + 1) * space + index * thickness),
  )
}

/** Every position that gives equal spaces, each once, in order. */
export function equalSpaceGuides(span: SnapSpan): EqualSpaceGuide[] {
  const guides = new Map<number, EqualSpaceGuide>()
  for (const spaces of DIVISIONS)
    divisionPositions(span, spaces).forEach((position, index) => {
      if (guides.has(position)) return
      const percent = Math.round(((index + 1) / spaces) * 100)
      guides.set(position, { position, percent, spaces })
    })
  return [...guides.values()].sort((a, b) => a.position - b.position)
}

/** The nearest equal-space position within `tolerance`, otherwise the nearest
 * round step. Placement choice only: positions stay whole numbers. */
export function snapPosition(
  value: number,
  span: SnapSpan,
  unit: MeasurementUnit,
  tolerance: number,
): number {
  const nearest = equalSpaceGuides(span).reduce<number | null>(
    (best, { position }) =>
      Math.abs(position - value) <= tolerance &&
      (best === null || Math.abs(position - value) < Math.abs(best - value))
        ? position
        : best,
    null,
  )
  const step = snapStep(unit)
  return nearest ?? Math.round(value / step) * step
}
