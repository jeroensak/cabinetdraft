import { duplicateCabinet } from '../module-list/moduleActions'
import { FrontProperties } from './FrontProperties'
import { frontName } from '../frontName'
import { useProjectStore } from '../../store/projectStore'
import { spacesInRange } from '../../store/selection'
import {
  renameModule,
  setModuleDimensions,
  moveShelf,
  addShelfToSpace,
  addDoor,
  addDrawerFront,
} from '../../domain/commands'
import { DraftField } from '../../components/DraftField'
import { deleteSelection } from '../deleteSelection'
import { useCommandAction } from '../useCommandAction'

export function PropertiesInspector() {
  const project = useProjectStore((state) => state.present)
  const selection = useProjectStore((state) => state.editor.selection)
  const execute = useProjectStore((state) => state.execute)
  const { error, run } = useCommandAction()
  const module = project.modules.find((item) => item.id === selection?.moduleId)
  const front =
    selection?.type === 'front'
      ? module?.fronts.find((item) => item.id === selection.frontId)
      : undefined
  const shelf =
    selection?.type === 'shelf'
      ? module?.shelves.find((item) => item.id === selection.shelfId)
      : undefined
  const spaces =
    selection?.type === 'space'
      ? spacesInRange(project, selection.moduleId, selection.range)
      : []
  return (
    <aside className="properties-inspector" aria-label="Properties">
      <p className="eyebrow">{selection?.type ?? 'Cabinet'}</p>
      {module && selection ? (
        <>
          <h2>
            {selection.type === 'module'
              ? module.name
              : selection.type === 'shelf'
                ? 'Shelf'
                : selection.type === 'space'
                  ? 'Selected space'
                  : front
                    ? frontName(front)
                    : 'Front'}
          </h2>
          <p className="muted">
            {selection.type === 'module' ? 'Selected module' : module.name}
          </p>
          {selection.type === 'module' && (
            <>
              <DraftField
                key={`${module.id}-${module.name}`}
                label="Name"
                value={module.name}
                onCommit={(name) =>
                  run(() =>
                    execute((project) =>
                      renameModule(project, module.id, name),
                    ),
                  )
                }
              />
              <h3 className="eyebrow dimension-heading">Dimensions</h3>
              {(['width', 'height', 'depth'] as const).map((dimension) => (
                <DraftField
                  key={`${module.id}-${dimension}-${module[dimension]}`}
                  label={dimension}
                  numeric
                  value={module[dimension]}
                  onCommit={(value) =>
                    run(() =>
                      execute((project) =>
                        setModuleDimensions(project, module.id, {
                          [dimension]: Number(value),
                        }),
                      ),
                    )
                  }
                />
              ))}
              <p className="inspector-note muted">
                Outside dimensions. Global construction settings are available
                under Settings.
              </p>
            </>
          )}
          {front && (
            <FrontProperties
              module={module}
              front={front}
              settings={project.settings}
            />
          )}
          {shelf && (
            <>
              <DraftField
                key={`${shelf.id}-${shelf.bottom}`}
                label="Shelf bottom"
                numeric
                value={shelf.bottom}
                onCommit={(value) =>
                  run(() =>
                    execute((project) =>
                      moveShelf(project, module.id, shelf.id, Number(value)),
                    ),
                  )
                }
              />
              <p className="inspector-note muted">
                Position of the shelf’s bottom face, measured from the cabinet
                bottom. Drag the shelf to move it.
              </p>
            </>
          )}
          {selection.type === 'space' && (
            <>
              <p className="inspector-note muted">
                {spaces.length === 1
                  ? `${spaces[0].height} mm free height`
                  : `${spaces.length} contiguous spaces`}
              </p>
              <div className="context-actions">
                <button
                  className="pill primary"
                  disabled={spaces.length !== 1}
                  onClick={() =>
                    run(() =>
                      execute((project) =>
                        addShelfToSpace(project, module.id, selection.range),
                      ),
                    )
                  }
                >
                  Add shelf
                </button>
                <button
                  className="pill"
                  onClick={() =>
                    run(() =>
                      execute((project) =>
                        addDoor(project, module.id, selection.range),
                      ),
                    )
                  }
                >
                  Add door
                </button>
                <button
                  className="pill"
                  disabled={spaces.length !== 1}
                  onClick={() =>
                    run(() =>
                      execute((project) =>
                        addDrawerFront(project, module.id, selection.range),
                      ),
                    )
                  }
                >
                  Add drawer front
                </button>
              </div>
            </>
          )}
          {selection.type !== 'space' && (
            <div className="inspector-actions">
              {selection.type === 'module' && (
                <button
                  className="pill"
                  onClick={() => run(() => duplicateCabinet(module.id))}
                >
                  Duplicate
                </button>
              )}
              <button
                className="delete-button"
                onClick={() =>
                  run(() =>
                    execute((project) => deleteSelection(project, selection)),
                  )
                }
              >
                Delete
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="inspector-empty">
          <h2>No cabinet selected</h2>
          <p className="muted">
            Select a cabinet, shelf, or space to edit its properties.
          </p>
        </div>
      )}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </aside>
  )
}
