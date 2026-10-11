import { deriveFrontGeometry } from '../../domain/fronts/deriveFrontGeometry'
import { FrontTargets } from './FrontTargets'
import { useMemo, useRef, useState } from 'react'
import { deriveArrangement } from '../../domain/cabinet/deriveArrangement'
import { validateProject } from '../../domain/validation/validateProject'
import { useProjectStore } from '../../store/projectStore'
import { arrangementBounds, panelFaces, projectPoint } from './projection'
import { useCanvasViewport } from './useCanvasViewport'
import { Dimension } from './Dimension'
import { StructureTargets } from './StructureTargets'
import { orderFaces } from './orderFaces'

export function StructureCanvas() {
  const [mode, setMode] = useState<'structure' | 'fronts'>('structure')
  const project = useProjectStore((state) => state.present)
  const selection = useProjectStore((state) => state.editor.selection)
  const hover = useProjectStore((state) => state.editor.hover)
  const setSelection = useProjectStore((state) => state.setSelection)
  const setHover = useProjectStore((state) => state.setHover)
  const arrangement = useMemo(() => deriveArrangement(project), [project])
  const bounds = useMemo(() => arrangementBounds(arrangement), [arrangement])
  const moduleIds = useMemo(
    () => arrangement.modules.map(({ module }) => module.id),
    [arrangement],
  )
  const invalidIds = useMemo(
    () => new Set(validateProject(project).map((issue) => issue.moduleId)),
    [project],
  )
  const { svgRef, viewport, setViewport, size, fit, zoom } = useCanvasViewport(
    bounds,
    moduleIds,
  )
  const drag = useRef<{
    id: number
    x: number
    y: number
    pan: { x: number; y: number }
  } | null>(null)
  const faces = useMemo(
    () =>
      orderFaces(
        arrangement.modules
          .flatMap(({ module, origin, geometry }) =>
            [
              ...geometry.panels,
              ...(mode === 'fronts'
                ? module.fronts.flatMap(
                    (front) =>
                      deriveFrontGeometry(module, project.settings, front)
                        .panels,
                  )
                : []),
            ].flatMap((panel, index) =>
              panelFaces(panel, origin).map((face) => ({
                ...face,
                module,
                key: `${module.id}-${index}-${face.side}`,
                source: panel.source.type,
                layer:
                  panel.source.type === 'door' || panel.source.type === 'drawer'
                    ? 1
                    : 0,
              })),
            ),
          )
          .sort((a, b) => a.layer - b.layer || a.distance - b.distance),
      ),
    [arrangement, mode, project.settings],
  )
  const screen = (x: number, y: number, z = 0) => {
    const p = projectPoint({ x, y, z })
    return {
      x: p.x * viewport.zoom + viewport.pan.x,
      y: p.y * viewport.zoom + viewport.pan.y,
    }
  }
  const selected = arrangement.modules.find(
    ({ module }) => module.id === selection?.moduleId,
  )
  const hoverModule = (moduleId: string) =>
    setHover({ type: 'module', moduleId })
  return (
    <>
      <div className="editor-toolbar">
        <span className="muted">
          {arrangement.totalWidth.toLocaleString('en-US')} mm total width
        </span>
        <div className="segmented view-switch" aria-label="Designer view">
          {(['structure', 'fronts'] as const).map((view) => (
            <button
              key={view}
              aria-pressed={mode === view}
              className={mode === view ? 'selected' : undefined}
              onClick={() => {
                setMode(view)
                setHover(null)
                if (
                  selection &&
                  ((view === 'structure' && selection.type === 'front') ||
                    (view === 'fronts' && selection.type === 'shelf'))
                )
                  setSelection({ type: 'module', moduleId: selection.moduleId })
              }}
            >
              {view === 'structure' ? 'Structure' : 'Fronts'}
            </button>
          ))}
        </div>
        <div className="canvas-controls">
          <div className="zoom-control">
            <button onClick={() => zoom(1 / 1.2)} aria-label="Zoom out">
              −
            </button>
            <span>{Math.round(viewport.zoom * 100)}%</span>
            <button onClick={() => zoom(1.2)} aria-label="Zoom in">
              +
            </button>
          </div>
          <button className="pill" onClick={fit}>
            Fit to view
          </button>
        </div>
      </div>
      <h1 id="designer-title" className="sr-only">
        Designer
      </h1>
      <svg
        ref={svgRef}
        className="structure-canvas"
        aria-label="Cabinet structure"
        onPointerDown={(event) => {
          if (event.button !== 0 || event.target !== event.currentTarget) return
          drag.current = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            pan: viewport.pan,
          }
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          if (!drag.current || drag.current.id !== event.pointerId) return
          setViewport({
            pan: {
              x: drag.current.pan.x + event.clientX - drag.current.x,
              y: drag.current.pan.y + event.clientY - drag.current.y,
            },
          })
        }}
        onPointerUp={(event) => {
          if (drag.current?.id !== event.pointerId) return
          drag.current = null
          event.currentTarget.releasePointerCapture(event.pointerId)
        }}
        onPointerCancel={() => {
          drag.current = null
        }}
        onLostPointerCapture={() => {
          drag.current = null
        }}
        onPointerLeave={() => setHover(null)}
      >
        <title>Cabinet structure</title>
        <desc>
          {mode === 'structure'
            ? 'Structure view. Select spaces or shelves to edit.'
            : 'Fronts view. Select a front to edit. Shift-click adjacent empty spaces to select a range.'}{' '}
          Drag empty canvas to pan; scroll to zoom.
        </desc>
        <g
          aria-hidden="true"
          transform={`translate(${viewport.pan.x} ${viewport.pan.y}) scale(${viewport.zoom})`}
        >
          {faces.map((face) => (
            <polygon
              key={face.key}
              points={face.points.map((p) => `${p.x},${p.y}`).join(' ')}
              className={`panel-face face-${face.side}`}
              data-module-id={face.module.id}
              data-source={face.source}
              data-selected={selection?.moduleId === face.module.id}
              data-hovered={hover?.moduleId === face.module.id}
              data-invalid={invalidIds.has(face.module.id)}
              onPointerEnter={() => hoverModule(face.module.id)}
              onPointerLeave={() => setHover(null)}
              onClick={() =>
                setSelection({ type: 'module', moduleId: face.module.id })
              }
            />
          ))}
        </g>
        {/* Transparent front hit areas let the module's empty spaces select it too. */}
        {arrangement.modules.map(({ module, origin }) => {
          const bottom = screen(origin.x, 0)
          const top = screen(origin.x, module.height)
          return (
            <g key={module.id}>
              <rect
                className="module-hit-area"
                x={Math.min(top.x, bottom.x)}
                y={Math.min(top.y, bottom.y)}
                width={Math.max(1, Math.abs(module.width * viewport.zoom))}
                height={Math.max(1, Math.abs(module.height * viewport.zoom))}
                role="button"
                tabIndex={0}
                aria-label={`Select ${module.name}`}
                aria-pressed={selection?.moduleId === module.id}
                data-selected={selection?.moduleId === module.id}
                data-hovered={hover?.moduleId === module.id}
                data-invalid={invalidIds.has(module.id)}
                onPointerEnter={() => hoverModule(module.id)}
                onPointerLeave={() => setHover(null)}
                onClick={() =>
                  setSelection({ type: 'module', moduleId: module.id })
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setSelection({ type: 'module', moduleId: module.id })
                  }
                }}
              />
              {invalidIds.has(module.id) && (
                <text
                  className="invalid-geometry-label"
                  x={top.x}
                  y={top.y - 12}
                >
                  ! Invalid geometry
                </text>
              )}
            </g>
          )
        })}
        {arrangement.modules.map((item) => (
          <StructureTargets
            key={item.module.id}
            item={item}
            screen={screen}
            zoom={viewport.zoom}
            frontsMode={mode === 'fronts'}
          />
        ))}
        {mode === 'fronts' && <FrontTargets arrangement={arrangement} />}
        {arrangement.modules.length > 0 && (
          <g className="dimension-layer">
            <Dimension
              from={screen(0, 0)}
              to={screen(arrangement.totalWidth, 0)}
              offset={60}
              label={`${arrangement.totalWidth} mm total`}
            />
            <Dimension
              from={screen(0, 0)}
              to={screen(0, arrangement.maximumHeight)}
              vertical
              offset={-58}
              label={`max ${arrangement.maximumHeight} mm`}
            />
            {selected && (
              <>
                <Dimension
                  from={screen(selected.origin.x, 0)}
                  to={screen(selected.origin.x + selected.module.width, 0)}
                  offset={28}
                  label={`${selected.module.width} mm width`}
                />
                <Dimension
                  from={screen(selected.origin.x + selected.module.width, 0)}
                  to={screen(
                    selected.origin.x + selected.module.width,
                    selected.module.height,
                  )}
                  vertical
                  offset={28}
                  label={`${selected.module.height} mm height`}
                />
                <Dimension
                  from={screen(
                    selected.origin.x + selected.module.width,
                    selected.module.height,
                  )}
                  to={screen(
                    selected.origin.x + selected.module.width,
                    selected.module.height,
                    selected.module.depth,
                  )}
                  offset={-26}
                  label={`${selected.module.depth} mm depth`}
                />
              </>
            )}
          </g>
        )}
        {arrangement.modules.length === 0 && (
          <text
            className="canvas-empty"
            x={size.width / 2}
            y={size.height / 2}
            textAnchor="middle"
          >
            No cabinets to display
          </text>
        )}
      </svg>
    </>
  )
}
