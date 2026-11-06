import type { SheetPriority, SheetStock } from '../domain/cutlist/sheetLayout'
import type { MeasurementUnit } from '../domain/project/units'
import { UNITS_PER_INCH } from '../domain/project/units'

export const SHEET_STOCK_STORAGE_KEY = 'cabinet-designer:sheet-stock'

/** The workshop's board and saw, and what a plan should save first. */
export interface SheetPreference extends SheetStock {
  priority: SheetPriority
}

const inches = (length: number, width: number): [number, number] => [
  length * UNITS_PER_INCH,
  width * UNITS_PER_INCH,
]

/** Common board sizes, longest side first, in each unit's stored numbers. */
export const SHEET_SIZES: Record<MeasurementUnit, [number, number][]> = {
  mm: [
    [2440, 1220],
    [2500, 1250],
    [2800, 2070],
    [3050, 1220],
    [3050, 1525],
    [1525, 1525],
    [1220, 610],
  ],
  inch: [
    inches(96, 48),
    inches(120, 48),
    inches(120, 60),
    inches(60, 60),
    inches(48, 48),
    inches(48, 24),
  ],
}

/** 4 mm or 1/8 inch: wider than most blades, because a kerf set too wide costs
 * a little board, while one set too narrow makes parts come out short. */
const DEFAULT_KERF: Record<MeasurementUnit, number> = { mm: 4, inch: 4 }

const defaultPreference = (unit: MeasurementUnit): SheetPreference => {
  const [length, width] = SHEET_SIZES[unit][0]!
  return { length, width, kerf: DEFAULT_KERF[unit], priority: 'cuts' }
}

const isPreference = (value: unknown): value is SheetPreference => {
  const stock = value as Partial<SheetPreference> | null
  return (
    typeof stock === 'object' &&
    stock !== null &&
    Number.isSafeInteger(stock.length) &&
    Number.isSafeInteger(stock.width) &&
    Number.isSafeInteger(stock.kerf) &&
    stock.length! > 0 &&
    stock.width! > 0 &&
    stock.kerf! >= 0 &&
    (stock.priority === 'cuts' || stock.priority === 'sheets')
  )
}

function readAll(): Record<string, unknown> {
  try {
    const stored: unknown = JSON.parse(
      localStorage.getItem(SHEET_STOCK_STORAGE_KEY) ?? '{}',
    )
    return typeof stored === 'object' && stored !== null
      ? (stored as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

/** An editor preference, like the language: the workshop's board and saw
 * belong to the person, not the design, so it is never in Project JSON. */
export function loadSheetPreference(unit: MeasurementUnit): SheetPreference {
  const stored = readAll()[unit]
  return isPreference(stored) ? stored : defaultPreference(unit)
}

export function saveSheetPreference(
  unit: MeasurementUnit,
  preference: SheetPreference,
) {
  try {
    localStorage.setItem(
      SHEET_STOCK_STORAGE_KEY,
      JSON.stringify({ ...readAll(), [unit]: preference }),
    )
  } catch {
    // Unavailable storage only costs the remembered choice.
  }
}
