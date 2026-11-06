import type {
  LaidOutSheet,
  SheetPart,
  SheetStock,
} from '../domain/cutlist/sheetLayout'
import type { MeasurementUnit } from '../domain/project/units'
import { formatBare } from '../units'
import { partGroupOf } from './partGroups'

/** Text sizes relate to the sheet, so every drawing reads alike at any size. */
const TEXT_SHARE = 1 / 75
const CHARACTER_SHARE = 0.58
const LINE_HEIGHT = 1.25
/** Below this share of the normal size, a label can't be read at all. */
const SMALLEST_TEXT = 0.5

/** The ID and size where both fit, otherwise the ID alone, smaller if it has
 * to be, turned to run along the part when that makes it larger. Every part
 * also has a title with its size. */
function PartLabel({
  part,
  label,
  font,
}: {
  part: SheetPart
  label: string
  font: number
}) {
  const { x, y, spanX, spanY, id } = part
  /** The largest text size, up to the normal one, that fits these lines. */
  const fitted = (along: number, across: number, lines: string[]) => {
    const longest = Math.max(...lines.map((line) => line.length))
    return Math.min(
      font,
      along / ((longest + 1) * CHARACTER_SHARE),
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
  const centre = `translate(${x + spanX / 2} ${y + spanY / 2})`
  return (
    <text
      className="sheet-part-label"
      fontSize={size}
      textAnchor="middle"
      transform={flatSize >= turnedSize ? centre : `${centre} rotate(-90)`}
    >
      {lines.map((line, index) => (
        <tspan
          key={line}
          x={0}
          dy={
            index
              ? size * LINE_HEIGHT
              : lines.length > 1
                ? -size * 0.2
                : '0.35em'
          }
        >
          {line}
        </tspan>
      ))}
    </text>
  )
}

/** One sheet to scale: x runs along its length, the numbers give the cut order. */
export function SheetDrawing({
  sheet,
  stock,
  unit,
  label,
}: {
  sheet: LaidOutSheet
  stock: SheetStock
  unit: MeasurementUnit
  label: string
}) {
  const font = stock.length * TEXT_SHARE
  const badge = font * 0.8
  const partSize = ({ spanX, spanY }: SheetPart) =>
    [Math.max(spanX, spanY), Math.min(spanX, spanY)]
      .map((value) => formatBare(value, unit))
      .join(' × ')
  return (
    <svg
      className="sheet-drawing"
      viewBox={`0 0 ${stock.length} ${stock.width}`}
      role="img"
      aria-label={label}
    >
      <rect className="sheet-board" width={stock.length} height={stock.width} />
      {sheet.parts.map((part) => (
        <g key={part.id}>
          <rect
            className="sheet-part"
            data-group={partGroupOf(part.part)}
            x={part.x}
            y={part.y}
            width={part.spanX}
            height={part.spanY}
          >
            <title>{`${part.id} · ${partSize(part)}`}</title>
          </rect>
          <PartLabel part={part} label={partSize(part)} font={font} />
        </g>
      ))}
      {sheet.cuts.map((cut) => {
        // A sliver thinner than the kerf leaves the blade past the sheet's edge.
        const edge = cut.axis === 'x' ? stock.length : stock.width
        const centre = Math.min(cut.position + stock.kerf / 2, edge)
        const start = cut.from + badge * 1.2
        const [x, y] = cut.axis === 'x' ? [centre, start] : [start, centre]
        return (
          <g key={cut.order} className="sheet-cut">
            <line
              x1={cut.axis === 'x' ? centre : cut.from}
              y1={cut.axis === 'x' ? cut.from : centre}
              x2={cut.axis === 'x' ? centre : cut.to}
              y2={cut.axis === 'x' ? cut.to : centre}
            />
            <circle cx={x} cy={y} r={badge} />
            <text x={x} y={y} dy="0.35em" fontSize={font} textAnchor="middle">
              {cut.order}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
