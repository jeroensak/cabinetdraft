import type { MeasurementUnit } from '../domain/project/units'
import { UNITS_PER_INCH } from '../domain/project/units'
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
  const units = size * UNITS_PER_INCH
  return Number.isSafeInteger(units) ? units : null
}

const number = (value: number, grouped: boolean) =>
  value.toLocaleString(i18n.resolvedLanguage, { useGrouping: grouped })

/** A size with its unit: 800 mm, or 31 1/2". */
export function formatMeasure(
  value: number,
  unit: MeasurementUnit,
  grouped = false,
): string {
  return unit === 'inch'
    ? `${formatInches(value)}"`
    : `${number(value, grouped)} mm`
}

/** Several sizes together: 754 × 537 mm, or 31 1/2" × 20". */
export function formatSize(values: number[], unit: MeasurementUnit): string {
  return unit === 'inch'
    ? values.map((value) => formatMeasure(value, unit)).join(' × ')
    : `${values.map((value) => number(value, false)).join(' × ')} mm`
}

/** A size where the context already names the unit, as in a table column. */
export const formatBare = (value: number, unit: MeasurementUnit) =>
  unit === 'inch' ? formatInches(value) : number(value, false)

export const unitSymbol = (unit: MeasurementUnit) =>
  unit === 'inch' ? 'in' : 'mm'
