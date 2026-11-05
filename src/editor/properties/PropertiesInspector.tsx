import { duplicateCabinet } from '../module-list/moduleActions'
import { FrontProperties } from './FrontProperties'
import { frontName } from '../frontName'
import { useProjectStore } from '../../store/projectStore'
import {
  renameModule,
  setModuleDimensions,
  moveShelf,
  addShelfToSpace,
  addDoor,
  addDrawerFront,
  addDividerToSpace,
  moveDivider,
} from '../../domain/commands'
import { enclosingRange, spaceRange } from '../../domain/spaces/spaceRanges'
import { selectedSpaces } from '../../store/selection'
import { DraftField } from '../../components/DraftField'
import { deleteSelection } from '../deleteSelection'
import { useCommandAction } from '../useCommandAction'

export function PropertiesInspector() {
  const project = useProjectStore((state) => state.present)
  const selection = useProjectStore((state) => state.editor.selection)
  const setSelection = useProjectStore((state) => state.setSelection)
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
  const divider =
    selection?.type === 'divider'
      ? module?.dividers.find((item) => item.id === selection.dividerId)
      : undefined
  const spaces = selectedSpaces(project, selection)
  const doorRange = module
    ? enclosingRange(module, project.settings, spaces)
    : null
  const addDivider = () => {
    if (
      module &&
      spaces.length === 1 &&
      run(() =>
        execute((project) =>
          addDividerToSpace(project, module.id, spaceRange(spaces[0])),
        ),
      )
    )
      setSelection(null)
  }
  return (
    <aside className="properties-inspector" aria-label="Properties">
      {selection?.type === 'space' && module && (
        <button
          className="pill mb-4"
          title={`Select ${module.name}`}
          onClick={() => setSelection({ type: 'module', moduleId: module.id })}
        >
          ↑ Select cabinet
        </button>
      )}
      <p className="eyebrow">{selection?.type ?? 'Cabinet'}</p>
      {module && selection ? (
        <>
          <h2>
            {selection.type === 'module'
              ? module.name
              : selection.type === 'shelf'
                ? 'Shelf'
                : selection.type === 'divider'
                  ? 'Divider'
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
              {module.dividers.length > 0 && (
                <>
                  <h3 className="eyebrow dimension-heading">Dividers</h3>
                  <div className="context-actions">
                    {[...module.dividers]
                      .sort(
                        (a, b) => a.left - b.left || a.id.localeCompare(b.id),
                      )
                      .map((item, index) => (
                        <button
                          key={item.id}
                          className="pill"
                          onClick={() =>
                            setSelection({
                              type: 'divider',
                              moduleId: module.id,
                              dividerId: item.id,
                            })
                          }
                        >
                          Select divider {index + 1} at {item.left} mm
                        </button>
                      ))}
                  </div>
                </>
              )}
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
          {divider && (
            <>
              <DraftField
                key={`${divider.id}-${divider.left}`}
                label="Divider left"
                numeric
                value={divider.left}
                onCommit={(value) =>
                  run(() =>
                    execute((project) =>
                      moveDivider(
                        project,
                        module.id,
                        divider.id,
                        Number(value),
                      ),
                    ),
                  )
                }
              />
              <p className="inspector-note muted">
                Position of the divider’s left face from the cabinet’s outside
                left, in millimetres.
              </p>
            </>
          )}
          {selection.type === 'space' && (
            <>
              <p className="inspector-note muted">
                {spaces.length === 1
                  ? `${spaces[0].width} mm free width · ${spaces[0].height} mm free height`
                  : `${spaces.length} selected spaces`}
              </p>
              <p className="inspector-note muted">
                Shift-click neighbouring spaces to select more. Shelves and
                drawer fronts are added to each selected space. A door covers
                the selected rectangle.
              </p>
              <div className="context-actions">
                <button
                  className="pill primary"
                  disabled={!spaces.length}
                  onClick={() =>
                    run(() =>
                      execute((project) =>
                        spaces.reduce(
                          (next, space) =>
                            addShelfToSpace(next, module.id, spaceRange(space)),
                          project,
                        ),
                      ),
                    )
                  }
                >
                  Add shelf
                </button>
                <button
                  className="pill"
                  disabled={
                    spaces.length !== 1 ||
                    spaces[0].width <= project.settings.corpusThickness + 1
                  }
                  onClick={addDivider}
                >
                  Add divider
                </button>
                <button
                  className="pill"
                  disabled={!doorRange}
                  onClick={() => {
                    if (doorRange)
                      run(() =>
                        execute((project) =>
                          addDoor(project, module.id, doorRange),
                        ),
                      )
                  }}
                >
                  Add door
                </button>
                <button
                  className="pill"
                  disabled={!spaces.length}
                  onClick={() =>
                    run(() =>
                      execute((project) =>
                        spaces.reduce(
                          (next, space) =>
                            addDrawerFront(next, module.id, spaceRange(space)),
                          project,
                        ),
                      ),
                    )
                  }
                >
                  Add drawer front
                </button>
              </div>
              {!doorRange && spaces.length > 1 && (
                <p className="inspector-note muted">
                  Select a rectangle of spaces to add one spanning door.
                </p>
              )}
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
