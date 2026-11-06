import type {
  LaidOutSheet,
  SheetPart,
  SheetStock,
} from '../domain/cutlist/sheetLayout'
import type { MeasurementUnit } from '../domain/project/units'
import { partGroupOf } from './partGroups'
import {
  cutMarks,
  fitPartLabel,
  LINE_HEIGHT,
  partSizeLabel,
  sheetFontSize,
} from './sheetDrawingLayout'

function PartLabel({
  part,
  label,
  font,
}: {
  part: SheetPart
  label: string
  font: number
}) {
  const fit = fitPartLabel(part, label, font)
  if (!fit) return null
  const { lines, size, turned } = fit
  const { x, y, spanX, spanY } = part
  const centre = `translate(${x + spanX / 2} ${y + spanY / 2})`
  return (
    <text
      className="sheet-part-label"
      fontSize={size}
      textAnchor="middle"
      transform={turned ? `${centre} rotate(-90)` : centre}
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
  const font = sheetFontSize(stock)
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
            <title>{`${part.id} · ${partSizeLabel(part, unit)}`}</title>
          </rect>
          <PartLabel
            part={part}
            label={partSizeLabel(part, unit)}
            font={font}
          />
        </g>
      ))}
      {sheet.cuts.map((cut) => {
        const { x1, y1, x2, y2, badge, badgeX, badgeY } = cutMarks(cut, stock)
        return (
          <g key={cut.order} className="sheet-cut">
            <line x1={x1} y1={y1} x2={x2} y2={y2} />
            <circle cx={badgeX} cy={badgeY} r={badge} />
            <text
              x={badgeX}
              y={badgeY}
              dy="0.35em"
              fontSize={font}
              textAnchor="middle"
            >
              {cut.order}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
