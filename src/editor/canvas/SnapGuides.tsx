import {
  divisionPositions,
  equalSpaceGuides,
  type EqualSpaceGuide,
  type SnapSpan,
} from '../../domain/spaces/snapPosition'
import { useMeasure } from '../../units/useMeasure'
import type { Point } from './projection'

const PILL = { width: 30, height: 14 }

/** While a panel is dragged: a line at every equal-space position. Once it snaps
 * to one, that division's spaces light up with their inner size. */
export function SnapGuides({
  axis,
  position,
  span,
  across,
  originX,
  screen,
  zoom,
}: {
  axis: 'x' | 'y'
  position: number
  span: SnapSpan
  across: { start: number; size: number }
  originX: number
  screen: (x: number, y: number, z?: number) => Point
  zoom: number
}) {
  const { measure } = useMeasure()
  const guides = equalSpaceGuides(span)
  const snapped = guides.find((guide) => guide.position === position)
  const division = snapped ? divisionPositions(span, snapped.spaces) : []
  /** A point at `along` on the drag axis and `off` across it. */
  const point = (along: number, off: number) =>
    axis === 'x' ? screen(originX + along, off) : screen(originX + off, along)
  const acrossEnd = across.start + across.size
  const edges = [
    span.start,
    ...division.flatMap((edge) => [edge, edge + span.thickness]),
    span.start + span.size,
  ]
  const spaces = snapped
    ? edges.flatMap((from, index) =>
        index % 2 ? [] : [{ from, to: edges[index + 1]! }],
      )
    : []
  const line = (guide: EqualSpaceGuide) => {
    const centre = guide.position + span.thickness / 2
    return { from: point(centre, across.start), to: point(centre, acrossEnd) }
  }
  // At the far end of each line, just inside the cabinet, in two staggered
  // rows. Where a cabinet is too small for them all, the snapped ones win.
  const reach = axis === 'x' ? PILL.width + 2 : PILL.height + 2
  const taken: [number[], number[]] = [[], []]
  const pills = guides
    .map((guide, index) => {
      const { to } = line(guide)
      const row = index % 2
      return {
        guide,
        row,
        along: axis === 'x' ? to.x : to.y,
        active: division.includes(guide.position),
        ...(axis === 'x'
          ? {
              x: to.x - PILL.width / 2,
              y: to.y + 4 + row * (PILL.height + 2),
            }
          : {
              x: to.x - (PILL.width + 4) * (row + 1),
              y: to.y - PILL.height / 2,
            }),
      }
    })
    .toSorted((a, b) => Number(b.active) - Number(a.active))
    .filter(({ active, along, row }) => {
      if (
        !active &&
        taken[row as 0 | 1].some((at) => Math.abs(at - along) < reach)
      )
        return false
      taken[row as 0 | 1].push(along)
      return true
    })
    .reverse()
  return (
    <g className="snap-guides">
      {spaces.map(({ from, to }) => {
        const a = point(from, across.start)
        const b = point(to, acrossEnd)
        const middle = point((from + to) / 2, across.start + across.size / 2)
        return (
          <g key={from}>
            <rect
              className="snap-space"
              x={Math.min(a.x, b.x)}
              y={Math.min(a.y, b.y)}
              width={Math.abs(b.x - a.x)}
              height={Math.abs(b.y - a.y)}
            />
            {(to - from) * zoom > 16 && (
              <text
                className="snap-space-size"
                x={middle.x}
                y={middle.y + 4}
                textAnchor="middle"
              >
                {measure(to - from)}
              </text>
            )}
          </g>
        )
      })}
      {guides.map((guide) => {
        const from = line(guide).from
        const to = line(guide).to
        return (
          <line
            key={guide.position}
            className="snap-guide"
            data-active={division.includes(guide.position)}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
          />
        )
      })}
      {pills.map(({ guide, x, y, active }) => (
        <g key={guide.position} className="snap-percent" data-active={active}>
          <rect
            x={x}
            y={y}
            rx={PILL.height / 2}
            width={PILL.width}
            height={PILL.height}
          />
          <text
            x={x + PILL.width / 2}
            y={y + PILL.height - 4}
            textAnchor="middle"
          >
            {guide.percent}%
          </text>
        </g>
      ))}
    </g>
  )
}
