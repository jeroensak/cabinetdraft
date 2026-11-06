import { duplicateCabinet } from '../module-list/moduleActions'
import {
  DoorLeavesField,
  DoorMountField,
  DrawerDesignField,
} from './FrontChoices'
import { FrontProperties } from './FrontProperties'
import { frontName } from '../frontName'
import { useTranslation } from '../../i18n'
import { useMeasure } from '../../units/useMeasure'

import { useProjectStore } from '../../store/projectStore'
import {
  renameModule,
  setModuleDimensions,
  moveShelf,
  addShelfToSpace,
  addDoor,
  removeFront,
  addDividerToSpace,
  moveDivider,
} from '../../domain/commands'
import {
  enclosingRange,
  frontsCovering,
  spaceRange,
} from '../../domain/spaces/spaceRanges'
import type { Front } from '../../domain/fronts/types'
import { selectedSpaces } from '../../store/selection'
import { DraftField } from '../../components/DraftField'
import { deleteWithNotice } from '../deleteSelection'
import { useCommandAction } from '../useCommandAction'

export function PropertiesInspector() {
  const { t } = useTranslation()
  const { measure, unit } = useMeasure()

  const project = useProjectStore((state) => state.present)
  const selection = useProjectStore((state) => state.editor.selection)
  const setSelection = useProjectStore((state) => state.setSelection)
  const execute = useProjectStore((state) => state.execute)
  const lastDoorMount = useProjectStore((state) => state.lastDoorMount)
  const openDrawerDesigner = useProjectStore(
    (state) => state.openDrawerDesigner,
  )
  const { error, run } = useCommandAction()
  const unitName = t(unit === 'inch' ? 'unit.inchPlural' : 'unit.mmPlural')

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
  const occupants =
    selection?.type === 'space' && module
      ? frontsCovering(module, project.settings, spaces)
      : []
  const doors = occupants.filter((item) => item.type === 'door')
  const drawers = occupants.filter((item) => item.type === 'drawer')
  const removeFronts = (fronts: Front[]) => {
    if (!module) return
    run(() =>
      execute((project) =>
        fronts.reduce(
          (next, item) => removeFront(next, module.id, item.id),
          project,
        ),
      ),
    )
  }
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
          <h2 className="clamped" title={module.name}>
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
                            left: measure(item.left),
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
                {t('inspector.dividerNote', { unit: unitName })}
              </p>
            </>
          )}
          {selection.type === 'space' && (
            <>
              <p className="inspector-note muted">
                {spaces.length === 1
                  ? t('inspector.freeSize', {
                      width: measure(spaces[0].width),
                      height: measure(spaces[0].height),
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
                  className="pill primary"
                  disabled={
                    spaces.length !== 1 ||
                    spaces[0].width <= project.settings.corpusThickness + 1
                  }
                  onClick={addDivider}
                >
                  {t('inspector.addDivider')}
                </button>
                {occupants.length === 0 && (
                  <>
                    <button
                      className="pill primary"
                      disabled={!doorRange}
                      onClick={() => {
                        if (doorRange)
                          run(() =>
                            execute((project) =>
                              addDoor(
                                project,
                                module.id,
                                doorRange,
                                1,
                                undefined,
                                lastDoorMount,
                              ),
                            ),
                          )
                      }}
                    >
                      {t('inspector.addDoor')}
                    </button>
                    <button
                      className="pill primary"
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
                  </>
                )}
                {doors.length > 0 && (
                  <button
                    className="pill danger"
                    onClick={() => removeFronts(doors)}
                  >
                    {t('inspector.removeDoor', { count: doors.length })}
                  </button>
                )}
                {drawers.length > 0 && (
                  <button
                    className="pill danger"
                    onClick={() => removeFronts(drawers)}
                  >
                    {t('inspector.removeDrawer', { count: drawers.length })}
                  </button>
                )}
              </div>
              {occupants.length === 0 && !doorRange && spaces.length > 1 && (
                <p className="inspector-note muted">
                  {t('inspector.rectangleNote')}
                </p>
              )}
              {occupants.length === 1 && occupants[0].type === 'door' && (
                <>
                  <DoorLeavesField
                    moduleId={module.id}
                    door={occupants[0]}
                    run={run}
                  />
                  <DoorMountField
                    moduleId={module.id}
                    door={occupants[0]}
                    run={run}
                  />
                </>
              )}
              {occupants.length === 1 && occupants[0].type === 'drawer' && (
                <>
                  <h3 className="eyebrow dimension-heading">
                    {t('frontInfo.drawerBox')}
                  </h3>
                  <DrawerDesignField
                    moduleId={module.id}
                    drawer={occupants[0]}
                    run={run}
                  />
                </>
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
                  {t('inspector.duplicate')}
                </button>
              )}
              <button
                className="delete-button"
                onClick={() => deleteWithNotice(run)}
              >
                {t('inspector.delete')}
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
