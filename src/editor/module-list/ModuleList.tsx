import { useState, type DragEvent } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { reorderModules } from '../../domain/commands'
import { useCommandAction } from '../useCommandAction'
import { addCabinet } from './moduleActions'

export function ModuleList() {
  const modules = useProjectStore((state) => state.present.modules)
  const selection = useProjectStore((state) => state.editor.selection)
  const hover = useProjectStore((state) => state.editor.hover)
  const setHover = useProjectStore((state) => state.setHover)
  const setSelection = useProjectStore((state) => state.setSelection)
  const execute = useProjectStore((state) => state.execute)
  const { error, run } = useCommandAction()
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{
    id: string
    after: boolean
  } | null>(null)
  const afterMidpoint = (event: DragEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return event.clientY > rect.top + rect.height / 2
  }
  return (
    <aside className="cabinet-sidebar" aria-labelledby="cabinet-list-title">
      <h2 className="eyebrow" id="cabinet-list-title">
        Cabinets
      </h2>
      <ul
        className="module-list"
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null))
            setDropTarget(null)
        }}
      >
        {modules.map((module) => (
          <li
            key={module.id}
            data-drop-edge={
              dropTarget?.id === module.id
                ? dropTarget.after
                  ? 'after'
                  : 'before'
                : undefined
            }
          >
            <button
              className="module-row"
              draggable
              data-dragging={draggedId === module.id}
              data-hovered={hover?.moduleId === module.id}
              onPointerEnter={() =>
                setHover({ type: 'module', moduleId: module.id })
              }
              onPointerLeave={() => setHover(null)}
              aria-label={`${module.name}, ${module.width} mm`}
              aria-pressed={selection?.moduleId === module.id}
              onClick={() =>
                setSelection({ type: 'module', moduleId: module.id })
              }
              onDragStart={(event) => {
                setDraggedId(module.id)
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData('text/plain', module.id)
              }}
              onDragEnd={() => {
                setDraggedId(null)
                setDropTarget(null)
                setHover(null)
              }}
              onDragOver={(event) => {
                if (!draggedId) return
                event.preventDefault()
                event.dataTransfer.dropEffect = 'move'
                setDropTarget({ id: module.id, after: afterMidpoint(event) })
              }}
              onDrop={(event) => {
                event.preventDefault()
                if (draggedId && draggedId !== module.id) {
                  const after = afterMidpoint(event)
                  run(() =>
                    execute((project) => {
                      const ids = project.modules
                        .map((item) => item.id)
                        .filter((id) => id !== draggedId)
                      const target = ids.indexOf(module.id)
                      ids.splice(target + (after ? 1 : 0), 0, draggedId)
                      return reorderModules(project, ids)
                    }),
                  )
                }
                setDraggedId(null)
                setDropTarget(null)
                setHover(null)
              }}
            >
              <span className="module-marker" aria-hidden="true">
                ⋮⋮
              </span>
              <span className="module-label">
                <strong>{module.name}</strong>
                <small>{module.width} mm</small>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {modules.length === 0 && (
        <p className="muted sidebar-note">No cabinets in this project.</p>
      )}
      <button className="add-cabinet" onClick={() => run(addCabinet)}>
        + Add cabinet
      </button>
      <div className="sidebar-tip">
        <p className="eyebrow">Tip</p>
        <p>Drag cabinets to reorder them.</p>
      </div>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </aside>
  )
}
