import { useMemo } from 'react'
import { useTranslation } from '../i18n'
import { useProjectStore } from '../store/projectStore'
import { useMeasure } from '../units/useMeasure'

import type { DrawerGeometry } from '../domain/drawers/deriveDrawerGeometry'
import type {
  PhysicalPanel,
  PhysicalPosition,
} from '../domain/geometry/physicalPanel'
import type { ProjectSettings } from '../domain/project/types'
import { Dimension } from '../editor/canvas/Dimension'
import { orderFaces } from '../editor/canvas/orderFaces'
import { panelFaces, projectPoint } from '../editor/canvas/projection'

const WIDTH = 720
const HEIGHT = 440
const PADDING = 64
/** Room beside the drawing for the height label. */
const SIDE_PADDING = 96
const ORIGIN: PhysicalPosition = { x: 0, y: 0, z: 0 }
/** How far the drawer is shown pulled out, as a share of its depth. */
const OPEN_SHARE = 0.66

/** The part of the cabinet around the opening, for context in this preview
 * only. The Cut List's panels come from the domain, never from here. */
function cabinetSection(
  { opening, carcassDepth }: DrawerGeometry,
  settings: ProjectSettings,
): PhysicalPanel[] {
  const { left, right, bottom, top } = opening
  const thickness = settings.corpusThickness
  const width = right - left
  const height = top - bottom
  const panel = (
    type: 'side-left' | 'side-right' | 'top' | 'bottom' | 'back',
    orientation: PhysicalPanel['orientation'],
    length: number,
    panelWidth: number,
    panelThickness: number,
    position: PhysicalPosition,
  ): PhysicalPanel => ({
    moduleId: '',
    source: { type },
    orientation,
    length,
    width: panelWidth,
    thickness: panelThickness,
    position,
  })
  const y = bottom - thickness
  const sideLength = height + 2 * thickness
  return [
    panel('side-left', 'side', sideLength, carcassDepth, thickness, {
      x: left - thickness,
      y,
      z: 0,
    }),
    panel('side-right', 'side', sideLength, carcassDepth, thickness, {
      x: right,
      y,
      z: 0,
    }),
    panel('bottom', 'horizontal', width, carcassDepth, thickness, {
      x: left,
      y,
      z: 0,
    }),
    panel('top', 'horizontal', width, carcassDepth, thickness, {
      x: left,
      y: top,
      z: 0,
    }),
    ...(settings.backPanelEnabled
      ? [
          panel(
            'back',
            'face',
            sideLength,
            width + 2 * thickness,
            settings.backPanelThickness,
            { x: left - thickness, y, z: carcassDepth },
          ),
        ]
      : []),
  ]
}

/** Presentation of canonical drawer geometry; sizes come from the domain only. */
export function DrawerPreview({
  geometry,
  showFront,
  open,
}: {
  geometry: DrawerGeometry
  showFront: boolean
  open: boolean
}) {
  const { t } = useTranslation()
  const { measure, size } = useMeasure()
  const settings = useProjectStore((state) => state.present.settings)

  const { opening } = geometry
  const pull = open ? Math.round(geometry.depth * OPEN_SHARE) : 0

  const walls = useMemo(
    () =>
      geometry.boxPanels.filter(
        (panel) => panel.source.type !== 'drawer-bottom',
      ),
    [geometry],
  )
  const bottom = geometry.boxPanels.find(
    (panel) => panel.source.type === 'drawer-bottom',
  )
  const groove = walls[0]?.groove
  const faces = useMemo(() => {
    const pulledOut = (panel: PhysicalPanel) => ({
      ...panel,
      position: { ...panel.position, z: panel.position.z - pull },
    })
    // Closed, an overlay front is drawn straight-on against the cabinet face:
    // the angled view would shift it off the wall centres it really stops at.
    const flush = (panel: PhysicalPanel) =>
      !open && panel.source.type === 'drawer' && panel.position.z < 0
    const drawer = [
      ...walls,
      ...(showFront ? geometry.standaloneFrontPanels : []),
    ].map((panel) =>
      flush(panel)
        ? { ...panel, position: { ...panel.position, z: 0 } }
        : pulledOut(panel),
    )
    return orderFaces(
      [...cabinetSection(geometry, settings), ...drawer]
        .flatMap((panel, index) => {
          const isDrawer = panel.source.type.startsWith('drawer')
          const isFront = panel.source.type === 'drawer'
          return panelFaces(panel, ORIGIN)
            .filter((face) => face.side === 'front' || !isFront || open)
            .map((face) => ({
              ...face,
              key: `${index}-${face.side}`,
              source: isDrawer ? panel.source.type : 'cabinet',
              layer: isFront ? 2 : isDrawer ? 1 : 0,
            }))
        })
        .sort((a, b) => a.layer - b.layer || a.distance - b.distance),
    )
  }, [walls, geometry, settings, showFront, open, pull])
  // Drawn last and unsorted: the plate shows through the walls that hide it.
  const bottomFaces = bottom
    ? panelFaces(
        {
          ...bottom,
          position: { ...bottom.position, z: bottom.position.z - pull },
        },
        ORIGIN,
      )
    : []
  const points = faces.flatMap((face) => face.outline)
  const valid =
    points.length > 0 &&
    points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
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
        (WIDTH - 2 * SIDE_PADDING) / Math.max(1, bounds.maxX - bounds.minX),
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
  const boxZ = (box?.z ?? 0) - pull
  // Below the lowest point, which is now the pulled-out drawer.
  const baseline = bounds.maxY * scale + offset.y
  const onBaseline = (x: number, z: number) => ({
    x: screen(x, 0, z).x,
    y: baseline,
  })
  // Above the cabinet's back edge, the highest point of the drawing.
  const bottomLabel =
    bottom &&
    screen(
      (opening.left + opening.right) / 2,
      opening.top + settings.corpusThickness,
      geometry.carcassDepth,
    )
  return (
    <svg
      className="drawer-preview"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={t('drawer.previewLabel', {
        size: size(geometry.width, geometry.height, geometry.depth),
      })}
    >
      {valid ? (
        <>
          <g transform={`translate(${offset.x} ${offset.y}) scale(${scale})`}>
            {faces.map((face) => (
              <polygon
                key={face.key}
                className={`panel-face face-${face.side}`}
                data-source={face.source}
                points={face.outline.map((p) => `${p.x},${p.y}`).join(' ')}
              />
            ))}
            <g className="drawer-bottom-plate">
              {bottomFaces.map((face) => (
                <polygon
                  key={face.side}
                  data-face={face.side}
                  points={face.outline.map((p) => `${p.x},${p.y}`).join(' ')}
                />
              ))}
            </g>
          </g>
          {box && (
            <g className="dimension-layer">
              {bottom && groove && bottomLabel && (
                <g className="dimension drawer-bottom-label">
                  <text
                    x={bottomLabel.x}
                    y={bottomLabel.y - 42}
                    textAnchor="middle"
                  >
                    <tspan x={bottomLabel.x}>
                      {t('drawer.bottomLabel', {
                        thickness: measure(bottom.thickness),
                        height: measure(groove.fromEdge),
                      })}
                    </tspan>
                    <tspan x={bottomLabel.x} dy={16}>
                      {t('drawer.grooveLabel', {
                        depth: measure(groove.depth),
                      })}
                    </tspan>
                    <tspan x={bottomLabel.x} dy={16}>
                      {t('drawer.gapsLabel', {
                        side: measure(geometry.gaps.side),
                        bottom: measure(geometry.gaps.bottom),
                        top: measure(geometry.gaps.top),
                        rear: measure(geometry.gaps.rear),
                      })}
                    </tspan>
                  </text>
                </g>
              )}
              <Dimension
                from={onBaseline(box.x, boxZ)}
                to={onBaseline(box.x + geometry.width, boxZ)}
                offset={18}
                label={t('drawer.boxWidth', { value: measure(geometry.width) })}
              />
              <Dimension
                from={onBaseline(opening.left, 0)}
                to={onBaseline(opening.right, 0)}
                offset={40}
                label={t('drawer.openingWidth', {
                  value: measure(geometry.openingWidth),
                })}
              />
              <Dimension
                from={screen(box.x, box.y, boxZ)}
                to={screen(box.x, box.y + geometry.height, boxZ)}
                vertical
                offset={-24}
                label={measure(geometry.height)}
              />
              <Dimension
                from={screen(
                  box.x + geometry.width,
                  box.y + geometry.height,
                  boxZ,
                )}
                to={screen(
                  box.x + geometry.width,
                  box.y + geometry.height,
                  boxZ + geometry.depth,
                )}
                offset={-18}
                label={t('drawer.depthLabel', {
                  value: measure(geometry.depth),
                })}
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
          {t('drawer.previewUnavailable')}
        </text>
      )}
    </svg>
  )
}
