import type {
  PhysicalPanel,
  PhysicalPosition,
} from '../../domain/geometry/physicalPanel'
import type { Arrangement } from '../../domain/cabinet/deriveArrangement'

export interface Point {
  x: number
  y: number
}
export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}
export interface Viewport {
  zoom: number
  pan: Point
}

// Shallow axonometric projection follows the approved front-facing Figma view.
// x points right, y up, and depth recedes up/right. This never defines panel sizes.
export function projectPoint({ x, y, z }: PhysicalPosition): Point {
  return { x: x + z * 0.18, y: -y - z * 0.1 }
}

export function panelFaces(panel: PhysicalPanel, origin: PhysicalPosition) {
  const { length, width, thickness, orientation, position } = panel
  const [dx, dy, dz] =
    orientation === 'side'
      ? [thickness, length, width]
      : orientation === 'horizontal'
        ? [length, thickness, width]
        : [width, length, thickness]
  // Invalid physical panels stay in project/domain data; don't draw inverted solids.
  if (![dx, dy, dz].every((value) => Number.isFinite(value) && value > 0))
    return []
  const corner = (x: number, y: number, z: number): PhysicalPosition => ({
    x: origin.x + position.x + x,
    y: origin.y + position.y + y,
    z: origin.z + position.z + z,
  })
  const faces = [
    {
      side: 'front',
      corners: [
        corner(0, 0, 0),
        corner(dx, 0, 0),
        corner(dx, dy, 0),
        corner(0, dy, 0),
      ],
    },
    {
      side: 'right',
      corners: [
        corner(dx, 0, 0),
        corner(dx, 0, dz),
        corner(dx, dy, dz),
        corner(dx, dy, 0),
      ],
    },
    {
      side: 'top',
      corners: [
        corner(0, dy, 0),
        corner(dx, dy, 0),
        corner(dx, dy, dz),
        corner(0, dy, dz),
      ],
    },
  ]
  return faces.map(({ side, corners }) => ({
    side,
    points: corners.map(projectPoint),
    // Camera direction is (0.18, 0.1, -1); far faces are painted first.
    distance:
      corners.reduce((sum, p) => sum + p.x * 0.18 + p.y * 0.1 - p.z, 0) / 4,
  }))
}

export function arrangementBounds(arrangement: Arrangement): Bounds {
  const points = arrangement.modules.flatMap(({ module, origin, geometry }) => [
    ...[0, module.width].flatMap((x) =>
      [0, module.height].flatMap((y) =>
        [0, module.depth].map((z) => projectPoint({ x: origin.x + x, y, z })),
      ),
    ),
    ...geometry.panels.flatMap((panel) =>
      panelFaces(panel, origin).flatMap((face) => face.points),
    ),
  ])
  return points.reduce<Bounds>(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxX: Math.max(bounds.maxX, point.x),
      maxY: Math.max(bounds.maxY, point.y),
    }),
    { minX: 0, minY: 0, maxX: 0, maxY: 0 },
  )
}

export function fitViewport(
  bounds: Bounds,
  width: number,
  height: number,
): Viewport {
  const zoom = Math.min(
    Math.max(1, width - 320) / Math.max(1, bounds.maxX - bounds.minX),
    Math.max(1, height - 180) / Math.max(1, bounds.maxY - bounds.minY),
    2,
  )
  return {
    zoom,
    pan: {
      x: width / 2 - ((bounds.minX + bounds.maxX) / 2) * zoom,
      y: height / 2 - ((bounds.minY + bounds.maxY) / 2) * zoom,
    },
  }
}

export function zoomAt(
  viewport: Viewport,
  anchor: Point,
  factor: number,
): Viewport {
  const zoom = Math.min(8, Math.max(0.001, viewport.zoom * factor))
  const ratio = zoom / viewport.zoom
  return {
    zoom,
    pan: {
      x: anchor.x - (anchor.x - viewport.pan.x) * ratio,
      y: anchor.y - (anchor.y - viewport.pan.y) * ratio,
    },
  }
}

export function isInView(
  bounds: Bounds,
  viewport: Viewport,
  width: number,
  height: number,
) {
  return (
    bounds.minX * viewport.zoom + viewport.pan.x >= 60 &&
    bounds.maxX * viewport.zoom + viewport.pan.x <= width - 60 &&
    bounds.minY * viewport.zoom + viewport.pan.y >= 60 &&
    bounds.maxY * viewport.zoom + viewport.pan.y <= height - 60
  )
}
