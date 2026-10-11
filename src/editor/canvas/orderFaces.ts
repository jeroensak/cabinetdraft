import type { panelFaces, Point } from './projection'

type Face = ReturnType<typeof panelFaces>[number]
const EPSILON = 1e-7
const cross = (a: Point, b: Point, p: Point) =>
  (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)

/** Intersect projected convex faces. Touching edges do not obscure a surface. */
function overlap(a: Point[], b: Point[]): Point[] {
  let polygon = a
  const winding = Math.sign(
    b.reduce((sum, p, i) => {
      const next = b[(i + 1) % b.length]
      return sum + p.x * next.y - next.x * p.y
    }, 0),
  )
  for (let i = 0; i < b.length && polygon.length; i++) {
    const start = b[i]
    const end = b[(i + 1) % b.length]
    const input = polygon
    polygon = []
    for (let j = 0; j < input.length; j++) {
      const p = input[j]
      const q = input[(j + 1) % input.length]
      const dp = winding * cross(start, end, p)
      const dq = winding * cross(start, end, q)
      if (dp >= 0) polygon.push(p)
      if (dp < 0 !== dq < 0) {
        const t = dp / (dp - dq)
        polygon.push({ x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y) })
      }
    }
  }
  const area = polygon.reduce((sum, p, i) => {
    const q = polygon[(i + 1) % polygon.length]
    return sum + p.x * q.y - q.x * p.y
  }, 0)
  return Math.abs(area) > EPSILON ? polygon : []
}

/** Interpolate world depth on the face plane using its projected basis. */
function depthAt(face: Face, point: Point): number {
  const [a, b, , c] = face.points
  const determinant = cross(a, b, c)
  const u =
    ((point.x - a.x) * (c.y - a.y) - (point.y - a.y) * (c.x - a.x)) /
    determinant
  const v = cross(a, b, point) / determinant
  const [pa, pb, , pc] = face.corners
  return pa.z + u * (pb.z - pa.z) + v * (pc.z - pa.z)
}

/** Painter order comes from depth where faces actually overlap, not their centres.
 * A full-height side must hide every shelf end, regardless of shelf elevation.
 * No manufacturing dimensions are calculated here.
 */
export function orderFaces<T extends Face>(faces: T[]): T[] {
  const edges = faces.map(() => new Set<number>())
  const incoming = faces.map(() => 0)
  const bounds = faces.map((face) => ({
    left: Math.min(...face.points.map((p) => p.x)),
    right: Math.max(...face.points.map((p) => p.x)),
    top: Math.min(...face.points.map((p) => p.y)),
    bottom: Math.max(...face.points.map((p) => p.y)),
  }))
  for (let i = 0; i < faces.length; i++) {
    for (let j = i + 1; j < faces.length; j++) {
      const a = bounds[i],
        b = bounds[j]
      if (
        a.right <= b.left ||
        b.right <= a.left ||
        a.bottom <= b.top ||
        b.bottom <= a.top
      )
        continue
      const intersection = overlap(faces[i].points, faces[j].points)
      if (!intersection.length) continue
      const centre = intersection.reduce(
        (sum, p) => ({
          x: sum.x + p.x / intersection.length,
          y: sum.y + p.y / intersection.length,
        }),
        { x: 0, y: 0 },
      )
      const delta = depthAt(faces[i], centre) - depthAt(faces[j], centre)
      if (Math.abs(delta) <= EPSILON) continue
      const [far, near] = delta > 0 ? [i, j] : [j, i]
      edges[far].add(near)
      incoming[near]++
    }
  }
  const remaining = new Set(faces.map((_, i) => i))
  const result: T[] = []
  while (remaining.size) {
    // Preserve input order for unrelated/coplanar faces. Invalid intersecting
    // geometry can create cycles; draw it deterministically without altering it.
    const next =
      [...remaining].find((i) => incoming[i] === 0) ??
      remaining.values().next().value!
    remaining.delete(next)
    result.push(faces[next])
    for (const near of edges[next]) incoming[near]--
  }
  return result
}
