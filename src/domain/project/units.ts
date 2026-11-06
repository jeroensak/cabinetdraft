export type MeasurementUnit = 'mm' | 'inch'

/** Inch designs store whole 1/32 inch units, so every size stays exact: 1/16"
 * has no whole-millimetre value, and halving a 1/16" size is still whole. */
export const UNITS_PER_INCH = 32
const MM_PER_INCH = 25.4

export const inches = (value: number) => value * UNITS_PER_INCH

export function mmToInchUnits(mm: number, grid: number) {
  return Math.round(((mm / MM_PER_INCH) * UNITS_PER_INCH) / grid) * grid
}

/** Sizes that may fall on a half unit: 0.5 mm, or 1/64". */
export const isHalfStep = (value: number) =>
  value >= 0 && Number.isSafeInteger(value * 2)

/** Refuses typing slips such as an extra digit, not unusual furniture. */
export const maxCabinetSize = (unit: MeasurementUnit = 'mm') =>
  unit === 'inch' ? inches(4000) : 100_000
