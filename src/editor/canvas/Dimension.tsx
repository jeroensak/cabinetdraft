import type { Point } from './projection'

/** Screen-space annotation: label values are supplied by physical domain data. */
export function Dimension({
  from,
  to,
  label,
  offset = 0,
  vertical = false,
}: {
  from: Point
  to: Point
  label: string
  offset?: number
  vertical?: boolean
}) {
  const a = {
    x: from.x + (vertical ? offset : 0),
    y: from.y + (vertical ? 0 : offset),
  }
  const b = {
    x: to.x + (vertical ? offset : 0),
    y: to.y + (vertical ? 0 : offset),
  }
  return (
    <g className="dimension" aria-label={label}>
      <path d={`M${a.x},${a.y} L${b.x},${b.y}`} />
      {[a, b].map((p, index) => (
        <path
          key={index}
          d={vertical ? `M${p.x - 4},${p.y} h8` : `M${p.x},${p.y - 4} v8`}
        />
      ))}
      <text
        x={(a.x + b.x) / 2 + (vertical ? (offset > 0 ? 8 : -8) : 0)}
        y={(a.y + b.y) / 2 + (vertical ? 3 : 16)}
        textAnchor={vertical ? (offset > 0 ? 'start' : 'end') : 'middle'}
      >
        {label}
      </text>
    </g>
  )
}
