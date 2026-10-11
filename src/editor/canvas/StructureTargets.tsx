import { useEffect, useRef, useState } from 'react'
import type { Arrangement } from '../../domain/cabinet/deriveArrangement'
import { deriveSpaces } from '../../domain/spaces/deriveSpaces'
import { sameBoundary } from '../../domain/commands/core'
import { spacesInRange } from '../../store/selection'
import { selectSpace } from '../spaceSelection'
import { moveShelf } from '../../domain/commands'
import { useProjectStore } from '../../store/projectStore'
import { commandMessage } from '../useCommandAction'
import type { Point } from './projection'

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
  const { module, origin, geometry } = item
  const project = useProjectStore((state) => state.present)
  const selection = useProjectStore((state) => state.editor.selection)
  const setSelection = useProjectStore((state) => state.setSelection)
  const setHover = useProjectStore((state) => state.setHover)
  const [error, setError] = useState<string | null>(null)
  const drag = useRef<{
    pointer: number
    y: number
    bottom: number
    shelfId: string
    zoom: number
    started: boolean
  } | null>(null)
  const cancel = () => {
    if (drag.current?.started) useProjectStore.getState().cancelProjectPreview()
    drag.current = null
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
              sameBoundary(covered.bottomBoundary, space.bottomBoundary),
            ),
          )
        )
          return null
        const p = screen(origin.x + project.settings.corpusThickness, space.top)
        const selected =
          selection?.type === 'space' &&
          selection.moduleId === module.id &&
          spacesInRange(project, module.id, selection.range).some((item) =>
            sameBoundary(item.bottomBoundary, space.bottomBoundary),
          )
        const choose = (extend = false) =>
          setSelection(
            selectSpace(project, module.id, space, selection, extend),
          )
        return (
          <rect
            key={JSON.stringify([space.bottomBoundary, space.topBoundary])}
            className="space-hit-area"
            x={p.x}
            y={p.y}
            width={Math.max(0, geometry.internalWidth * zoom)}
            height={Math.max(0, space.height * zoom)}
            role="button"
            tabIndex={0}
            aria-label={`${module.name} space ${index + 1}`}
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
          .filter((panel) => panel.source.type === 'shelf')
          .map((panel) => {
            if (panel.source.type !== 'shelf') return null
            const shelfId = panel.source.shelfId
            const p = screen(
              origin.x + panel.position.x,
              panel.position.y + panel.thickness,
            )
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
                  aria-label={`${module.name} shelf at ${panel.position.y} mm`}
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
                  onPointerDown={(event) => {
                    if (event.button !== 0) return
                    event.stopPropagation()
                    choose()
                    setError(null)
                    drag.current = {
                      pointer: event.pointerId,
                      y: event.clientY,
                      bottom: panel.position.y,
                      shelfId,
                      zoom,
                      started: false,
                    }
                    event.currentTarget.setPointerCapture(event.pointerId)
                  }}
                  onPointerMove={(event) => {
                    const current = drag.current
                    if (!current || current.pointer !== event.pointerId) return
                    const state = useProjectStore.getState()
                    if (current.started && !state.previewBase) {
                      drag.current = null
                      return
                    }
                    const delta = event.clientY - current.y
                    if (!current.started && Math.abs(delta) < 2) return
                    if (!current.started) {
                      state.beginProjectPreview()
                      current.started = true
                    }
                    try {
                      state.updateProjectPreview(
                        moveShelf(
                          useProjectStore.getState().previewBase!,
                          module.id,
                          current.shelfId,
                          Math.round(current.bottom - delta / current.zoom),
                        ),
                      )
                      setError(null)
                    } catch (error) {
                      setError(commandMessage(error))
                    }
                  }}
                  onPointerUp={(event) => {
                    if (
                      !drag.current ||
                      drag.current.pointer !== event.pointerId
                    )
                      return
                    if (drag.current.started)
                      useProjectStore.getState().commitProjectPreview()
                    drag.current = null
                    event.currentTarget.releasePointerCapture(event.pointerId)
                  }}
                  onPointerCancel={cancel}
                  onLostPointerCapture={cancel}
                />
                {selection?.type === 'shelf' &&
                  selection.shelfId === shelfId && (
                    <text className="shelf-position" x={p.x + 8} y={p.y - 10}>
                      {panel.position.y} mm from bottom
                    </text>
                  )}
              </g>
            )
          })}
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
