import type {
  SheetCut,
  SheetPart,
  SheetStock,
} from '../domain/cutlist/sheetLayout'
import type { MeasurementUnit } from '../domain/project/units'
import { formatBare } from '../units'

/** The one set of drawing rules for the Sheets view and the PDF. Everything is
 * in the sheet's own units, so each medium only has to scale it. */
const TEXT_SHARE = 1 / 75
const BADGE_SHARE = 0.8
const CHARACTER_SHARE = 0.58
export const LINE_HEIGHT = 1.25
/** Below this share of the normal size, a label can't be read at all. */
const SMALLEST_TEXT = 0.5
/** Kept free at the ends of a label, in text sizes: a cut's number sits there. */
const BADGE_ROOM = 3

export const sheetFontSize = (stock: SheetStock) => stock.length * TEXT_SHARE

export const partSizeLabel = (
  { spanX, spanY }: SheetPart,
  unit: MeasurementUnit,
) =>
  [Math.max(spanX, spanY), Math.min(spanX, spanY)]
    .map((value) => formatBare(value, unit))
    .join(' × ')

/** The ID and size where both fit, otherwise the ID alone, smaller if it has
 * to be, turned to run along the part when that makes it larger. Null when
 * even that can't be read, which leaves the part to its title or the list. */
export function fitPartLabel(part: SheetPart, label: string, font: number) {
  const { spanX, spanY, id } = part
  /** The largest text size, up to the normal one, that fits these lines. */
  const fitted = (along: number, across: number, lines: string[]) => {
    const longest = Math.max(...lines.map((line) => line.length))
    return Math.min(
      font,
      (along - BADGE_ROOM * font) / (longest * CHARACTER_SHARE),
      across / (lines.length * LINE_HEIGHT),
    )
  }
  const both = [id, label]
  const lines = [both, [id]].find(
    (text) =>
      Math.max(fitted(spanX, spanY, text), fitted(spanY, spanX, text)) ===
        font || text.length === 1,
  )!
  const flatSize = fitted(spanX, spanY, lines)
  const turnedSize = fitted(spanY, spanX, lines)
  const size = Math.max(flatSize, turnedSize)
  if (size < font * SMALLEST_TEXT) return null
  return { lines, size, turned: turnedSize > flatSize }
}

/** Where a cut's line and its number go. The line follows the middle of the
 * blade, which a sliver thinner than the kerf would put past the sheet's edge. */
export function cutMarks(cut: SheetCut, stock: SheetStock) {
  const edge = cut.axis === 'x' ? stock.length : stock.width
  const centre = Math.min(cut.position + stock.kerf / 2, edge)
  const badge = sheetFontSize(stock) * BADGE_SHARE
  const start = cut.from + badge * 1.2
  const across = cut.axis === 'x'
  return {
    x1: across ? centre : cut.from,
    y1: across ? cut.from : centre,
    x2: across ? centre : cut.to,
    y2: across ? cut.to : centre,
    badge,
    badgeX: across ? centre : start,
    badgeY: across ? start : centre,
  }
}
