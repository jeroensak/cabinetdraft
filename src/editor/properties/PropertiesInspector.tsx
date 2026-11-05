import { duplicateCabinet } from '../module-list/moduleActions'
import { FrontProperties } from './FrontProperties'
import { frontName } from '../frontName'
import { useTranslation } from '../../i18n'
import { useProjectStore } from '../../store/projectStore'
import {
  renameModule,
  setModuleDimensions,
  moveShelf,
  addShelfToSpace,
  addDoor,
  addDividerToSpace,
  moveDivider,
} from '../../domain/commands'
import { enclosingRange, spaceRange } from '../../domain/spaces/spaceRanges'
import { selectedSpaces } from '../../store/selection'
import { DraftField } from '../../components/DraftField'
import { deleteSelection } from '../deleteSelection'
import { useCommandAction } from '../useCommandAction'

export function PropertiesInspector() {
  const { t } = useTranslation()

  const project = useProjectStore((state) => state.present)
  const selection = useProjectStore((state) => state.editor.selection)
  const setSelection = useProjectStore((state) => state.setSelection)
  const execute = useProjectStore((state) => state.execute)
  const openDrawerDesigner = useProjectStore(
    (state) => state.openDrawerDesigner,
  )
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
    <aside className="properties-inspector" aria-label={t('inspector.label')}>
      {selection?.type === 'space' && module && (
        <button
          className="pill mb-4"
          title={t('inspector.select', { name: module.name })}
          onClick={() => setSelection({ type: 'module', moduleId: module.id })}
        >
          {t('inspector.selectCabinet')}
        </button>
      )}
      <p className="eyebrow">{t(`selection.${selection?.type ?? 'none'}`)}</p>
      {module && selection ? (
        <>
          <h2>
            {selection.type === 'module'
              ? module.name
              : selection.type === 'shelf'
                ? t('inspector.shelf')
                : selection.type === 'divider'
                  ? t('inspector.divider')
                  : selection.type === 'space'
                    ? t('inspector.selectedSpace')
                    : front
                      ? frontName(front)
                      : t('inspector.front')}
          </h2>
          <p className="muted">
            {selection.type === 'module'
              ? t('inspector.selectedModule')
              : module.name}
          </p>
          {selection.type === 'module' && (
            <>
              <DraftField
                key={`${module.id}-${module.name}`}
                label={t('inspector.name')}
                value={module.name}
                onCommit={(name) =>
                  run(() =>
                    execute((project) =>
                      renameModule(project, module.id, name),
                    ),
                  )
                }
              />
              <h3 className="eyebrow dimension-heading">
                {t('inspector.dimensions')}
              </h3>
              {(['width', 'height', 'depth'] as const).map((dimension) => (
                <DraftField
                  key={`${module.id}-${dimension}-${module[dimension]}`}
                  label={t(`dimension.${dimension}`)}
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
                {t('inspector.outsideNote')}
              </p>
              {module.dividers.length > 0 && (
                <>
                  <h3 className="eyebrow dimension-heading">
                    {t('inspector.dividers')}
                  </h3>
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
                          {t('inspector.selectDivider', {
                            n: index + 1,
                            left: item.left,
                          })}
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
                label={t('inspector.shelfBottom')}
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
              <p className="inspector-note muted">{t('inspector.shelfNote')}</p>
            </>
          )}
          {divider && (
            <>
              <DraftField
                key={`${divider.id}-${divider.left}`}
                label={t('inspector.dividerLeft')}
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
                {t('inspector.dividerNote')}
              </p>
            </>
          )}
          {selection.type === 'space' && (
            <>
              <p className="inspector-note muted">
                {spaces.length === 1
                  ? t('inspector.freeSize', {
                      width: spaces[0].width,
                      height: spaces[0].height,
                    })
                  : t('inspector.selectedSpaces', { n: spaces.length })}
              </p>
              <p className="inspector-note muted">{t('inspector.spaceNote')}</p>
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
                  {t('inspector.addShelf')}
                </button>
                <button
                  className="pill"
                  disabled={
                    spaces.length !== 1 ||
                    spaces[0].width <= project.settings.corpusThickness + 1
                  }
                  onClick={addDivider}
                >
                  {t('inspector.addDivider')}
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
                  {t('inspector.addDoor')}
                </button>
                <button
                  className="pill"
                  disabled={!spaces.length}
                  onClick={() =>
                    openDrawerDesigner({
                      moduleId: module.id,
                      ranges: spaces.map(spaceRange),
                      designId: null,
                    })
                  }
                >
                  {t('inspector.addDrawer')}
                </button>
              </div>
              {!doorRange && spaces.length > 1 && (
                <p className="inspector-note muted">
                  {t('inspector.rectangleNote')}
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
                  {t('inspector.duplicate')}{' '}
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
                {t('inspector.delete')}{' '}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="inspector-empty">
          <h2>{t('inspector.noneTitle')}</h2>
          <p className="muted">{t('inspector.noneBody')}</p>
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
