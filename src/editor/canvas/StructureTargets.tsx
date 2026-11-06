import { useEffect, useRef, useState, type PointerEvent } from 'react'
import type { Arrangement } from '../../domain/cabinet/deriveArrangement'
import { deriveSpaces } from '../../domain/spaces/deriveSpaces'
import { deriveCarcassDimensions } from '../../domain/cabinet/deriveCarcassDimensions'
import { sameSpace } from '../../domain/spaces/boundaries'
import { snapPosition } from '../../domain/spaces/snapPosition'
import { spaceRange } from '../../domain/spaces/spaceRanges'
import { spacesInRange, selectedSpaces } from '../../store/selection'
import { selectSpace } from '../spaceSelection'
import { moveDivider, moveShelf } from '../../domain/commands'
import type { Project } from '../../domain/project/types'
import { useTranslation } from '../../i18n'
import { useMeasure } from '../../units/useMeasure'

import { useProjectStore } from '../../store/projectStore'
import { commandMessage } from '../useCommandAction'
import { Dimension } from './Dimension'
import { SnapGuides } from './SnapGuides'
import type { Point } from './projection'

/** Screen pixels within which a dragged panel jumps to an equal-space position. */
const SNAP_DISTANCE = 6
/** Left of the cabinet, inside the overall height dimension. */
const SHELF_MEASURE_OFFSET = -24

export function StructureTargets({
  item,
  screen,
  zoom,
  frontsMode = false,
}: {
  item: Arrangement['modules'][number]
  screen: (x: number, y: number, z?: number) => Point
  zoom: number
  frontsMode?: boolean
}) {
  const { t } = useTranslation()
  const { measure } = useMeasure()
  const { module, origin, geometry } = item

  const project = useProjectStore((state) => state.present)
  const selection = useProjectStore((state) => state.editor.selection)
  const setSelection = useProjectStore((state) => state.setSelection)
  const setHover = useProjectStore((state) => state.setHover)
  const [error, setError] = useState<string | null>(null)
  const [guide, setGuide] = useState<{
    axis: 'x' | 'y'
    position: number
  } | null>(null)
  const drag = useRef<{
    pointer: number
    start: number
    value: number
    axis: 'x' | 'y'
    move: (project: Project, value: number) => Project
    zoom: number
    started: boolean
  } | null>(null)
  const cancel = () => {
    if (drag.current?.started) useProjectStore.getState().cancelProjectPreview()
    drag.current = null
    setGuide(null)
  }
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancel()
    }
    window.addEventListener('keydown', escape)
    window.addEventListener('blur', cancel)
    return () => {
      window.removeEventListener('keydown', escape)
      window.removeEventListener('blur', cancel)
      cancel()
    }
  }, [])
  const innerSpan = (axis: 'x' | 'y') => {
    const carcass = deriveCarcassDimensions(module, project.settings)
    return axis === 'x'
      ? { start: project.settings.corpusThickness, size: carcass.internalWidth }
      : {
          start: carcass.interiorBottom,
          size: carcass.interiorTop - carcass.interiorBottom,
        }
  }
  /** Drags a panel along one axis as a live preview, committed once on release. */
  const dragHandlers = (
    axis: 'x' | 'y',
    value: number,
    move: (project: Project, value: number) => Project,
    choose: () => void,
  ) => ({
    onPointerDown: (event: PointerEvent<SVGRectElement>) => {
      if (event.button !== 0) return
      event.stopPropagation()
      choose()
      setError(null)
      drag.current = {
        pointer: event.pointerId,
        start: axis === 'x' ? event.clientX : event.clientY,
        value,
        axis,
        move,
        zoom,
        started: false,
      }
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    onPointerMove: (event: PointerEvent<SVGRectElement>) => {
      const current = drag.current
      if (!current || current.pointer !== event.pointerId) return
      const state = useProjectStore.getState()
      if (current.started && !state.previewBase) {
        drag.current = null
        return
      }
      const delta =
        (current.axis === 'x' ? event.clientX : event.clientY) - current.start
      if (!current.started && Math.abs(delta) < 2) return
      if (!current.started) {
        state.beginProjectPreview()
        current.started = true
      }
      // Screen y grows downwards, physical y upwards.
      const moved = (current.axis === 'x' ? delta : -delta) / current.zoom
      const { corpusThickness, unit = 'mm' } = project.settings
      const position = snapPosition(
        current.value + moved,
        { ...innerSpan(current.axis), thickness: corpusThickness },
        unit,
        SNAP_DISTANCE / current.zoom,
      )
      setGuide({ axis: current.axis, position })
      try {
        state.updateProjectPreview(
          current.move(useProjectStore.getState().previewBase!, position),
        )
        setError(null)
      } catch (error) {
        setError(commandMessage(error))
      }
    },
    onPointerUp: (event: PointerEvent<SVGRectElement>) => {
      if (!drag.current || drag.current.pointer !== event.pointerId) return
      if (drag.current.started)
        useProjectStore.getState().commitProjectPreview()
      drag.current = null
      setGuide(null)
      event.currentTarget.releasePointerCapture(event.pointerId)
    },
    onPointerCancel: cancel,
    onLostPointerCapture: cancel,
  })
  const spaces = deriveSpaces(module, project.settings)
  return (
    <g>
      {spaces.map((space, index) => {
        // Covered spaces remain editable in Structure, but cannot be targeted
        // through an opaque front in Fronts mode (including keyboard focus).
        if (
          frontsMode &&
          module.fronts.some((front) =>
            spacesInRange(project, module.id, front).some((covered) =>
              sameSpace(covered, space),
            ),
          )
        )
          return null
        const p = screen(origin.x + space.left, space.top)
        const selected =
          selection?.type === 'space' &&
          selection.moduleId === module.id &&
          selectedSpaces(project, selection).some((item) =>
            sameSpace(item, space),
          )
        const choose = (extend = false) =>
          setSelection(
            selectSpace(project, module.id, space, selection, extend),
          )
        return (
          <rect
            key={JSON.stringify(spaceRange(space))}
            className="space-hit-area"
            x={p.x}
            y={p.y}
            width={Math.max(0, space.width * zoom)}
            height={Math.max(0, space.height * zoom)}
            role="button"
            tabIndex={0}
            aria-label={t('canvas.space', { name: module.name, n: index + 1 })}
            aria-pressed={selected}
            data-selected={selected}
            onClick={(event) => choose(event.shiftKey)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                choose(event.shiftKey)
              }
            }}
            onPointerEnter={() =>
              setHover({ type: 'space', moduleId: module.id, range: space })
            }
            onPointerLeave={() => setHover(null)}
          />
        )
      })}
      {!frontsMode &&
        geometry.panels
          .filter((panel) => panel.source.type === 'divider')
          .map((panel) => {
            if (panel.source.type !== 'divider') return null
            const dividerId = panel.source.dividerId
            const p = screen(
              origin.x + panel.position.x,
              panel.position.y + panel.length,
            )
            const selected =
              selection?.type === 'divider' && selection.dividerId === dividerId
            // Above the cabinet, clear of the panels, like the other dimensions.
            const cabinetTop = screen(origin.x, module.height)
            const measureY =
              screen(origin.x, module.height, module.depth).y - 30
            const choose = () =>
              setSelection({ type: 'divider', moduleId: module.id, dividerId })
            return (
              <g key={dividerId}>
                <rect
                  className="divider-hit-area"
                  x={p.x}
                  y={p.y}
                  width={Math.max(8, panel.thickness * zoom)}
                  height={Math.max(0, panel.length * zoom)}
                  role="button"
                  tabIndex={0}
                  aria-label={t('canvas.dividerAt', {
                    name: module.name,
                    value: measure(panel.position.x),
                  })}
                  aria-pressed={selected}
                  onPointerEnter={() =>
                    setHover({
                      type: 'divider',
                      moduleId: module.id,
                      dividerId,
                    })
                  }
                  onPointerLeave={() => setHover(null)}
                  onClick={choose}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      choose()
                    }
                  }}
                  {...dragHandlers(
                    'x',
                    panel.position.x,
                    (project, left) =>
                      moveDivider(project, module.id, dividerId, left),
                    choose,
                  )}
                />
                {selected && (
                  <g className="panel-measure">
                    <path
                      strokeDasharray="3 3"
                      d={`M${cabinetTop.x},${cabinetTop.y} V${measureY} M${p.x},${p.y} V${measureY}`}
                    />
                    <Dimension
                      from={{ x: cabinetTop.x, y: measureY }}
                      to={{ x: p.x, y: measureY }}
                      label={t('canvas.fromLeft', {
                        value: measure(panel.position.x),
                      })}
                    />
                  </g>
                )}
              </g>
            )
          })}
      {!frontsMode &&
        geometry.panels
          .filter((panel) => panel.source.type === 'shelf')
          .map((panel) => {
            if (panel.source.type !== 'shelf') return null
            const shelfId = panel.source.shelfId
            const p = screen(
              origin.x + panel.position.x,
              panel.position.y + panel.thickness,
            )
            const cabinetBottom = screen(origin.x, 0)
            const shelfBottom = screen(origin.x, panel.position.y).y
            const choose = () =>
              setSelection({ type: 'shelf', moduleId: module.id, shelfId })
            return (
              <g key={shelfId}>
                <rect
                  className="shelf-hit-area"
                  x={p.x}
                  y={p.y - 3}
                  width={Math.max(0, panel.length * zoom)}
                  height={Math.max(8, panel.thickness * zoom + 6)}
                  role="button"
                  tabIndex={0}
                  aria-label={t('canvas.shelfAt', {
                    name: module.name,
                    value: measure(panel.position.y),
                  })}
                  aria-pressed={
                    selection?.type === 'shelf' && selection.shelfId === shelfId
                  }
                  onPointerEnter={() =>
                    setHover({ type: 'shelf', moduleId: module.id, shelfId })
                  }
                  onPointerLeave={() => setHover(null)}
                  onClick={choose}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      choose()
                    }
                  }}
                  {...dragHandlers(
                    'y',
                    panel.position.y,
                    (project, bottom) =>
                      moveShelf(project, module.id, shelfId, bottom),
                    choose,
                  )}
                />
                {selection?.type === 'shelf' &&
                  selection.shelfId === shelfId && (
                    <g className="panel-measure">
                      <path
                        strokeDasharray="3 3"
                        d={`M${p.x},${shelfBottom} H${cabinetBottom.x + SHELF_MEASURE_OFFSET} M${cabinetBottom.x},${cabinetBottom.y} H${cabinetBottom.x + SHELF_MEASURE_OFFSET}`}
                      />
                      <Dimension
                        from={cabinetBottom}
                        to={{ x: cabinetBottom.x, y: shelfBottom }}
                        vertical
                        offset={SHELF_MEASURE_OFFSET}
                        label={t('canvas.fromBottom', {
                          value: measure(panel.position.y),
                        })}
                      />
                    </g>
                  )}
              </g>
            )
          })}
      {guide && (
        <SnapGuides
          axis={guide.axis}
          position={guide.position}
          span={{
            ...innerSpan(guide.axis),
            thickness: project.settings.corpusThickness,
          }}
          across={innerSpan(guide.axis === 'x' ? 'y' : 'x')}
          originX={origin.x}
          screen={screen}
          zoom={zoom}
        />
      )}
      {error && (
        <text
          role="alert"
          className="invalid-geometry-label"
          x={screen(origin.x, 0).x}
          y={screen(origin.x, 0).y + 22}
        >
          {error}
        </text>
      )}
    </g>
  )
}
