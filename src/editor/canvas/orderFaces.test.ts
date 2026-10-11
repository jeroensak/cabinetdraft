import { describe, expect, it } from 'vitest'
import { createDefaultProject } from '../../domain/project/createDefaultProject'
import { deriveArrangement } from '../../domain/cabinet/deriveArrangement'
import { deriveFrontGeometry } from '../../domain/fronts/deriveFrontGeometry'
import { orderFaces } from './orderFaces'
import { panelFaces, projectPoint, type Point } from './projection'

// Independent ray/plane check: the last painted surface at a screen point must
// be the nearest physical face on that ray, regardless of its panel's centre.
function rayDepth(face: ReturnType<typeof panelFaces>[number], p: Point) {
  const corner = face.corners[0]
  const z =
    face.side === 'front'
      ? corner.z
      : face.side === 'right'
        ? (p.x - corner.x) / 0.18
        : (-p.y - corner.y) / 0.1
  const world = { x: p.x - 0.18 * z, y: -p.y - 0.1 * z, z }
  for (const axis of ['x', 'y', 'z'] as const) {
    const min = Math.min(...face.corners.map((c) => c[axis]))
    const max = Math.max(...face.corners.map((c) => c[axis]))
    if (world[axis] < min - 1e-6 || world[axis] > max + 1e-6) return null
  }
  return z
}

function scene(fronts: boolean, varied: boolean) {
  const project = createDefaultProject()
  const base = project.modules[0]
  project.modules = [0, 1, 2].map((i) => ({
    ...base,
    id: `module-${i}`,
    height: varied ? [2200, 1800, 2500][i] : 2200,
    depth: varied ? [600, 800, 400][i] : 600,
    shelves: [400, 850, 1550].map((bottom) => ({
      id: `${i}-${bottom}`,
      bottom,
    })),
  }))
  return deriveArrangement(project)
    .modules.flatMap(({ module, geometry, origin }) =>
      [
        ...geometry.panels,
        ...(fronts
          ? module.fronts.flatMap(
              (front) =>
                deriveFrontGeometry(module, project.settings, front).panels,
            )
          : []),
      ].flatMap((panel) => panelFaces(panel, origin)),
    )
    .sort((a, b) => a.distance - b.distance)
}

function hiddenSurfaceErrors(faces: ReturnType<typeof panelFaces>) {
  let errors = 0
  for (const face of faces) {
    for (const u of [0.13, 0.51, 0.87])
      for (const v of [0.13, 0.51, 0.87]) {
        const [a, b, , c] = face.corners
        const p = projectPoint({
          x: a.x + u * (b.x - a.x) + v * (c.x - a.x),
          y: a.y + u * (b.y - a.y) + v * (c.y - a.y),
          z: a.z + u * (b.z - a.z) + v * (c.z - a.z),
        })
        const depths = faces
          .map((f) => rayDepth(f, p))
          .filter((z): z is number => z !== null)
        if (depths.at(-1)! - Math.min(...depths) > 1e-6) errors++
      }
  }
  return errors
}

describe('panel face occlusion', () => {
  it('reproduces upper shelf edges showing through sides with centre sorting', () => {
    expect(hiddenSurfaceErrors(scene(false, false))).toBeGreaterThan(0)
  })
  it.each([
    [false, false],
    [false, true],
    [true, false],
    [true, true],
  ])(
    'draws the nearest surface for fronts=%s and differing cabinet sizes=%s',
    (fronts, varied) => {
      const faces = scene(fronts, varied)
      const ordered = orderFaces(faces)
      expect(ordered).toHaveLength(faces.length)
      expect(new Set(ordered).size).toBe(faces.length)
      expect(hiddenSurfaceErrors(ordered)).toBe(0)
    },
  )
})
