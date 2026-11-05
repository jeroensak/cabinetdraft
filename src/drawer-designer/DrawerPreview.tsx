import { useMemo } from 'react'
import type { DrawerGeometry } from '../domain/drawers/deriveDrawerGeometry'
import type { PhysicalPosition } from '../domain/geometry/physicalPanel'
import { Dimension } from '../editor/canvas/Dimension'
import { orderFaces } from '../editor/canvas/orderFaces'
import { panelFaces, projectPoint } from '../editor/canvas/projection'

const WIDTH = 720
const HEIGHT = 440
const PADDING = 64
const ORIGIN: PhysicalPosition = { x: 0, y: 0, z: 0 }

/** Presentation of canonical drawer geometry; sizes come from the domain only. */
export function DrawerPreview({
  geometry,
  showFront,
}: {
  geometry: DrawerGeometry
  showFront: boolean
}) {
  const { opening } = geometry
  const faces = useMemo(
    () =>
      orderFaces(
        [...geometry.boxPanels, ...(showFront ? geometry.frontPanels : [])]
          .flatMap((panel, index) =>
            panelFaces(panel, ORIGIN).map((face) => ({
              ...face,
              key: `${index}-${face.side}`,
              source: panel.source.type,
              layer: panel.source.type === 'drawer' ? 1 : 0,
            })),
          )
          .sort((a, b) => a.layer - b.layer || a.distance - b.distance),
      ),
    [geometry, showFront],
  )
  const openingCorners = [
    { x: opening.left, y: opening.bottom, z: 0 },
    { x: opening.right, y: opening.bottom, z: 0 },
    { x: opening.right, y: opening.top, z: 0 },
    { x: opening.left, y: opening.top, z: 0 },
  ].map(projectPoint)
  const points = [...faces.flatMap((face) => face.points), ...openingCorners]
  const valid = points.every(
    (p) => Number.isFinite(p.x) && Number.isFinite(p.y),
  )
  const bounds = points.reduce(
    (b, p) => ({
      minX: Math.min(b.minX, p.x),
      maxX: Math.max(b.maxX, p.x),
      minY: Math.min(b.minY, p.y),
      maxY: Math.max(b.maxY, p.y),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
  )
  const scale = valid
    ? Math.min(
        (WIDTH - 2 * PADDING) / Math.max(1, bounds.maxX - bounds.minX),
        (HEIGHT - 2 * PADDING) / Math.max(1, bounds.maxY - bounds.minY),
      )
    : 1
  const offset = {
    x: (WIDTH - (bounds.maxX - bounds.minX) * scale) / 2 - bounds.minX * scale,
    y: (HEIGHT - (bounds.maxY - bounds.minY) * scale) / 2 - bounds.minY * scale,
  }
  const screen = (x: number, y: number, z = 0) => {
    const p = projectPoint({ x, y, z })
    return { x: p.x * scale + offset.x, y: p.y * scale + offset.y }
  }
  const box = geometry.boxPanels[0]?.position
  return (
    <svg
      className="drawer-preview"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={`Drawer preview: ${geometry.width} × ${geometry.height} × ${geometry.depth} mm box`}
    >
      {valid ? (
        <>
          <polygon
            className="drawer-opening"
            points={openingCorners
              .map((p) => `${p.x * scale + offset.x},${p.y * scale + offset.y}`)
              .join(' ')}
          />
          <g transform={`translate(${offset.x} ${offset.y}) scale(${scale})`}>
            {faces.map((face) => (
              <polygon
                key={face.key}
                className={`panel-face face-${face.side}`}
                data-source={face.source}
                points={face.points.map((p) => `${p.x},${p.y}`).join(' ')}
              />
            ))}
          </g>
          {box && (
            <g className="dimension-layer">
              <Dimension
                from={screen(box.x, opening.bottom)}
                to={screen(box.x + geometry.width, opening.bottom)}
                offset={30}
                label={`${geometry.width} mm box width`}
              />
              <Dimension
                from={screen(opening.left, opening.bottom)}
                to={screen(opening.right, opening.bottom)}
                offset={54}
                label={`${geometry.openingWidth} mm opening`}
              />
              <Dimension
                from={screen(box.x, box.y)}
                to={screen(box.x, box.y + geometry.height)}
                vertical
                offset={-24}
                label={`${geometry.height} mm`}
              />
              <Dimension
                from={screen(box.x + geometry.width, box.y + geometry.height)}
                to={screen(
                  box.x + geometry.width,
                  box.y + geometry.height,
                  geometry.depth,
                )}
                offset={-18}
                label={`${geometry.depth} mm deep`}
              />
            </g>
          )}
        </>
      ) : (
        <text
          className="canvas-empty"
          x={WIDTH / 2}
          y={HEIGHT / 2}
          textAnchor="middle"
        >
          Preview unavailable for this space
        </text>
      )}
    </svg>
  )
}
