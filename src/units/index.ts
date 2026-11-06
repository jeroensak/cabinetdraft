import type { MeasurementUnit } from '../domain/project/units'
import { isHalfStep, UNITS_PER_INCH } from '../domain/project/units'
import { i18n } from '../i18n'

export type { MeasurementUnit }

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)
const SIXTY_FOURTHS_PER_INCH = 64

/** Workshop notation such as 31 1/2. Halves of a stored unit stay exact as
 * 1/64ths; anything finer shows as a decimal rather than being rounded away. */
export function formatInches(value: number): string {
  const sign = value < 0 ? '-' : ''
  const size = Math.abs(value) * (SIXTY_FOURTHS_PER_INCH / UNITS_PER_INCH)
  if (!Number.isInteger(size)) return `${(value / UNITS_PER_INCH).toFixed(3)}`
  const whole = Math.floor(size / SIXTY_FOURTHS_PER_INCH)
  const rest = size % SIXTY_FOURTHS_PER_INCH
  if (!rest) return `${sign}${whole}`
  const divisor = gcd(rest, SIXTY_FOURTHS_PER_INCH)
  const fraction = `${rest / divisor}/${SIXTY_FOURTHS_PER_INCH / divisor}`
  return whole ? `${sign}${whole} ${fraction}` : `${sign}${fraction}`
}

/** Whole 1/32 inch units, or null when the text isn't an exact size: a value
 * finer than that is refused, never rounded. */
export function parseInches(text: string): number | null {
  const units = inchUnits(text)
  return Number.isSafeInteger(units) ? units : null
}

/** A size that may fall on a half unit: exact to 1/64", or null. */
export function parseHalfInches(text: string): number | null {
  const units = inchUnits(text)
  return isHalfStep(units) ? units : null
}

/** Millimetres in 0.5 steps, or null. */
export function parseHalfMillimetres(text: string): number | null {
  const input = text.trim()
  if (!/^\d*[.,]?\d+$/.test(input)) return null
  const size = Number(input.replace(',', '.'))
  return isHalfStep(size) ? size : null
}

function inchUnits(text: string): number {
  const input = text
    .trim()
    .replace(/\s*(?:"|″|in|inch|inches)$/i, '')
    .trim()
  const mixed = /^(\d+)(?:\s+|\s*-\s*)(\d+)\s*\/\s*(\d+)$/.exec(input)
  const fraction = /^(\d+)\s*\/\s*(\d+)$/.exec(input)
  const decimal = /^\d*[.,]?\d+$/.exec(input)
  const size = mixed
    ? Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3])
    : fraction
      ? Number(fraction[1]) / Number(fraction[2])
      : decimal
        ? Number(input.replace(',', '.'))
        : NaN
  return size * UNITS_PER_INCH
}

const number = (value: number, grouped: boolean) =>
  value.toLocaleString(i18n.resolvedLanguage, { useGrouping: grouped })

const INCHES_PER_FOOT = 12
/** Below this, workshop sizes read best in plain inches, such as 34 1/2". */
const FEET_FROM_INCHES = 48

/** A large size in feet and inches: 6' 8 1/2", or 8' when it is whole feet. */
function formatFeetAndInches(value: number): string {
  const perFoot = INCHES_PER_FOOT * UNITS_PER_INCH
  const size = Math.abs(value)
  const feet = Math.floor(size / perFoot)
  const rest = size - feet * perFoot
  const inches = rest ? ` ${formatInches(rest)}"` : ''
  return `${value < 0 ? '-' : ''}${feet}'${inches}`
}

/** A size with its unit: 800 mm, 31 1/2", or 6' 8". */
export function formatMeasure(
  value: number,
  unit: MeasurementUnit,
  grouped = false,
): string {
  if (unit !== 'inch') return `${number(value, grouped)} mm`
  return Math.abs(value) >= FEET_FROM_INCHES * UNITS_PER_INCH
    ? formatFeetAndInches(value)
    : `${formatInches(value)}"`
}

/** Several sizes together: 754 × 537 mm, or 31 1/2" × 20". */
export function formatSize(values: number[], unit: MeasurementUnit): string {
  return unit === 'inch'
    ? values.map((value) => formatMeasure(value, unit)).join(' × ')
    : `${values.map((value) => number(value, false)).join(' × ')} mm`
}

/** A sheet's size. Boards are sold in whole feet, so both sides then read
 * alike, as 4' × 2' rather than 4' × 24". */
export function formatSheetSize(
  length: number,
  width: number,
  unit: MeasurementUnit,
): string {
  const perFoot = INCHES_PER_FOOT * UNITS_PER_INCH
  return unit === 'inch' && length % perFoot === 0 && width % perFoot === 0
    ? `${length / perFoot}' × ${width / perFoot}'`
    : formatSize([length, width], unit)
}

/** A size where the context already names the unit, as in a table column. */
export const formatBare = (value: number, unit: MeasurementUnit) =>
  unit === 'inch' ? formatInches(value) : number(value, false)

/** A long total on the Cut List, which stays in plain inches. */
export const formatTotalLength = (value: number, unit: MeasurementUnit) =>
  unit === 'inch' ? `${formatInches(value)}"` : formatMeasure(value, unit, true)

export const unitSymbol = (unit: MeasurementUnit) =>
  unit === 'inch' ? 'in' : 'mm'
