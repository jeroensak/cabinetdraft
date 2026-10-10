import { describe, expect, it } from 'vitest'
import {
  projectPoint,
  panelFaces,
  fitViewport,
  zoomAt,
  isInView,
} from './projection'
import type { PhysicalPanel } from '../../domain/geometry/physicalPanel'

describe('SVG presentation geometry', () => {
  it('projects positive depth backwards and positive height upwards', () => {
    expect(projectPoint({ x: 100, y: 200, z: 50 })).toEqual({ x: 109, y: -205 })
  })
  it.each([
    ['side', { x: 118, y: 400, z: 350 }],
    ['horizontal', { x: 300, y: 218, z: 350 }],
    ['face', { x: 150, y: 400, z: 318 }],
  ] as const)(
    'maps %s panel axes without recomputing manufacturing dimensions',
    (orientation, corner) => {
      const panel: PhysicalPanel = {
        moduleId: 'a',
        source: { type: 'top' },
        length: 200,
        width: 50,
        thickness: 18,
        orientation,
        position: { x: 0, y: 0, z: 0 },
      }
      const points = panelFaces(panel, { x: 100, y: 200, z: 300 }).flatMap(
        (face) => face.points,
      )
      expect(points).toContainEqual(projectPoint(corner))
      expect(points).toContainEqual(projectPoint({ x: 100, y: 200, z: 300 }))
      expect(panel.length).toBe(200)
    },
  )
  it('fits tall and wide arrangements inside annotation margins', () => {
    for (const bounds of [
      { minX: 0, maxX: 5000, minY: -800, maxY: 0 },
      { minX: -200, maxX: 800, minY: -3000, maxY: 0 },
    ]) {
      const viewport = fitViewport(bounds, 800, 600)
      expect(isInView(bounds, viewport, 800, 600)).toBe(true)
      expect(viewport.zoom).toBeGreaterThan(0)
    }
  })
  it('keeps the world point under the cursor fixed when zooming, including at limits', () => {
    const viewport = { zoom: 0.5, pan: { x: 100, y: 80 } }
    const anchor = { x: 300, y: 250 }
    for (const factor of [1.2, 0.8, 10000, 0.00001]) {
      const next = zoomAt(viewport, anchor, factor)
      expect((anchor.x - next.pan.x) / next.zoom).toBeCloseTo(400)
      expect((anchor.y - next.pan.y) / next.zoom).toBeCloseTo(340)
      expect(next.zoom).toBeGreaterThanOrEqual(0.001)
      expect(next.zoom).toBeLessThanOrEqual(8)
    }
  })
})
