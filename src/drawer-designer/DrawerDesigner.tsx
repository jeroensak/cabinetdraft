import { useState } from 'react'
import { useTranslation } from '../i18n'
import { drawerIssueMessage } from '../i18n/drawerIssues'
import { DraftField } from '../components/DraftField'
import {
  addDrawerDesign,
  applyDrawerDesign,
  deleteDrawerDesign,
  drawerDesignUsage,
  updateDrawerDesign,
} from '../domain/commands'
import { deriveDrawerGeometry } from '../domain/drawers/deriveDrawerGeometry'
import {
  defaultDrawerDesign,
  MIN_DRAWER_SIDE_CLEARANCE,
  type DrawerDesign,
  type DrawerDesignInput,
} from '../domain/drawers/types'
import type { DrawerFront } from '../domain/fronts/types'
import type { Project } from '../domain/project/types'
import { sameSpace } from '../domain/spaces/boundaries'
import { deriveSpaces } from '../domain/spaces/deriveSpaces'
import { spaceRange, spacesForRange } from '../domain/spaces/spaceRanges'
import { useCommandAction } from '../editor/useCommandAction'
import {
  useProjectStore,
  type DrawerDesignerState,
} from '../store/projectStore'
import { DrawerDesignList } from './DrawerDesignList'
import { DrawerPreview } from './DrawerPreview'
import { uniqueDesignName } from './uniqueDesignName'

type MeasurementField = Exclude<
  keyof DrawerDesignInput,
  | 'name'
  | 'slideType'
  | 'heightPercent'
  | 'frontStyle'
  | 'frontMount'
  | 'frontHeightPercent'
>
const boxFields: MeasurementField[] = [
  'wallThickness',
  'bottomThickness',
  'depth',
]
const clearanceFields: MeasurementField[] = [
  'sideClearance',
  'bottomClearance',
  'topClearance',
  'rearClearance',
  'bottomRecess',
]

function designInput(design: DrawerDesign): DrawerDesignInput {
  const input: Partial<DrawerDesign> = { ...design }
  delete input.id
  return input as DrawerDesignInput
}

type DesignerScope = Pick<DrawerDesignerState, 'moduleId' | 'ranges'>

/** The library has no target; a design is previewed in a drawer that uses it. */
function libraryScope(
  project: Project,
  designId: string | null,
): DesignerScope {
  const design =
    project.drawerDesigns.find((item) => item.id === designId) ??
    project.drawerDesigns[0]
  for (const module of design ? project.modules : []) {
    const front = module.fronts.find(
      (item) => item.type === 'drawer' && item.drawerDesignId === design?.id,
    )
    if (front) return { moduleId: module.id, ranges: [spaceRange(front)] }
  }
  return { moduleId: null, ranges: [] }
}

/** Targets are stable ranges; spaces/fronts are re-derived on every render. */
function resolveTargets(project: Project, context: DesignerScope) {
  const module = project.modules.find((item) => item.id === context.moduleId)
  if (!module) return { module: undefined, targets: [] }
  const spaces = deriveSpaces(module, project.settings)
  const targets = context.ranges.flatMap((range) =>
    spaces
      .filter((space) => sameSpace(space, range))
      .map((space) => {
        const occupant = module.fronts.find((front) =>
          spacesForRange(module, project.settings, front).some((s) =>
            sameSpace(s, space),
          ),
        )
        return { space, occupant }
      }),
  )
  return { module, targets }
}

export function DrawerDesigner({ context }: { context: DrawerDesignerState }) {
  const { t } = useTranslation()

  const project = useProjectStore((state) => state.present)
  const execute = useProjectStore((state) => state.execute)
  const close = useProjectStore((state) => state.closeDrawerDesigner)
  const selectDesign = useProjectStore((state) => state.selectDrawerDesign)
  const { error, run } = useCommandAction()
  const [showFront, setShowFront] = useState(false)
  const library = context.moduleId === null
  const { module, targets } = resolveTargets(
    project,
    library ? libraryScope(project, context.designId) : context,
  )
  const linkedDesignId = targets
    .map(({ occupant }) =>
      occupant?.type === 'drawer' ? occupant.drawerDesignId : undefined,
    )
    .find(Boolean)
  const design =
    project.drawerDesigns.find((item) => item.id === context.designId) ??
    project.drawerDesigns.find((item) => item.id === linkedDesignId) ??
    project.drawerDesigns[0]
  const fits = module
    ? targets.map(({ space, occupant }) => {
        const front: DrawerFront = {
          id: occupant?.id ?? 'drawer-preview',
          type: 'drawer',
          ...spaceRange(space),
        }
        return design
          ? deriveDrawerGeometry(module, project.settings, front, design)
          : null
      })
    : []
  const preview = fits[0] ?? null
  const blockedByDoor = targets.some(
    ({ occupant }) => occupant?.type === 'door',
  )
  const fitIssues = fits.flatMap((geometry, index) =>
    (geometry?.issues ?? []).map((issue) => ({
      ...issue,
      target: index + 1,
    })),
  )
  const usage = design ? drawerDesignUsage(project, design.id) : 0
  const update = (patch: Partial<DrawerDesignInput>) =>
    design
      ? run(() =>
          execute((project) =>
            updateDrawerDesign(project, design.id, {
              ...designInput(design),
              ...patch,
            }),
          ),
        )
      : false
  const updateFront = (patch: Partial<DrawerDesignInput>) => {
    setShowFront(true)
    return update(patch)
  }
  const create = (input: DrawerDesignInput) => {
    if (run(() => execute((project) => addDrawerDesign(project, input))))
      selectDesign(useProjectStore.getState().present.drawerDesigns.at(-1)!.id)
  }
  const apply = () => {
    if (!design || !module) return
    if (
      run(() =>
        execute((project) =>
          applyDrawerDesign(
            project,
            design.id,
            targets.map(({ space }) => ({
              moduleId: module.id,
              range: spaceRange(space),
            })),
          ),
        ),
      )
    )
      close()
  }
  const targetLabel = t('drawer.selectedSpaces', { count: targets.length })
  return (
    <section
      className="designer-layout drawer-designer"
      aria-labelledby="drawer-designer-title"
    >
      <aside className="cabinet-sidebar" aria-label={t('drawer.designs')}>
        <button className="pill mb-4" onClick={close}>
          {t('drawer.back')}
        </button>
        <p className="eyebrow">{t('drawer.eyebrow')}</p>
        <h2 id="drawer-designer-title">{t('drawer.designs')}</h2>
        <DrawerDesignList
          selectedId={design?.id ?? ''}
          onSelect={selectDesign}
        />
        <button
          className="add-cabinet"
          onClick={() =>
            create({
              ...defaultDrawerDesign(),
              name: uniqueDesignName(project, t('default.drawerDesign')),
            })
          }
        >
          {t('drawer.new')}
        </button>
        <div className="sidebar-tip">
          <p className="eyebrow">Tip</p>
          <p>{t('drawer.tip')}</p>
        </div>
      </aside>
      <div className="editor-area">
        <div className="editor-toolbar">
          <span className="muted">
            {library
              ? module
                ? t('drawer.previewedIn', { name: module.name })
                : t('drawer.library')
              : module
                ? `${module.name} · ${targetLabel}`
                : t('drawer.cabinetUnavailable')}
            {preview &&
              t('drawer.opening', {
                width: preview.openingWidth,
                height: preview.openingHeight,
              })}
          </span>
          <label className="drawer-front-toggle">
            <input
              type="checkbox"
              checked={showFront}
              onChange={(event) => setShowFront(event.target.checked)}
            />
            {t('drawer.showFront')}
          </label>
        </div>
        {preview ? (
          <DrawerPreview geometry={preview} showFront={showFront} />
        ) : (
          <div className="drawer-preview-empty muted">
            {library
              ? design
                ? t('drawer.previewEmptyLibrary')
                : t('drawer.previewCreate')
              : targets.length === 0
                ? t('drawer.previewGone')
                : t('drawer.previewCreateSpace')}
          </div>
        )}
        <footer className="editor-status">
          {preview && (
            <span className="validation-badge" data-valid={!fitIssues.length}>
              {fitIssues.length ? t('drawer.doesNotFit') : t('drawer.fits')}
            </span>
          )}
          {preview && (
            <span>
              {t('drawer.boxSummary', {
                width: preview.width,
                height: preview.height,
                depth: preview.depth,
              })}
            </span>
          )}
        </footer>
      </div>
      <aside className="properties-inspector" aria-label={t('drawer.design')}>
        {design ? (
          <>
            <p className="eyebrow">{t('drawer.design')}</p>
            <h2>{design.name}</h2>
            <p className="muted">
              {usage === 0
                ? t('drawer.notUsedByAny')
                : t('drawer.sharedBy', { count: usage })}
            </p>
            <DraftField
              key={`${design.id}-name-${design.name}`}
              label={t('drawer.name')}
              value={design.name}
              onCommit={(name) => update({ name: name.trim() })}
            />
            <h3 className="eyebrow dimension-heading">{t('drawer.slides')}</h3>
            <p className="semantic-value">{t('drawer.undermount')}</p>
            <h3 className="eyebrow dimension-heading">{t('drawer.box')}</h3>
            <DraftField
              key={`${design.id}-heightPercent-${design.heightPercent}`}
              label={t('drawer.boxHeight')}
              numeric
              unit="%"
              value={design.heightPercent}
              onCommit={(value) => update({ heightPercent: Number(value) })}
            />
            {boxFields.map((field) => (
              <DraftField
                key={`${design.id}-${field}-${design[field]}`}
                label={t(`drawerField.${field}`)}
                numeric
                value={design[field]}
                onCommit={(value) => update({ [field]: Number(value) })}
              />
            ))}
            <h3 className="eyebrow dimension-heading">{t('drawer.front')}</h3>
            <label className="property-field">
              <span>{t('drawer.style')}</span>
              <select
                aria-label={t('drawer.frontStyle')}
                value={design.frontStyle}
                onChange={(event) =>
                  updateFront({
                    frontStyle: event.target
                      .value as DrawerDesign['frontStyle'],
                  })
                }
              >
                <option value="full">{t('drawer.styleFull')}</option>
                <option value="wave">{t('drawer.styleWave')}</option>
              </select>
            </label>
            <label className="property-field">
              <span>{t('drawer.position')}</span>
              <select
                aria-label={t('drawer.frontPosition')}
                value={design.frontMount}
                onChange={(event) =>
                  updateFront({
                    frontMount: event.target
                      .value as DrawerDesign['frontMount'],
                  })
                }
              >
                <option value="overlay">{t('drawer.positionOverlay')}</option>
                <option value="inset">{t('drawer.positionInset')}</option>
              </select>
            </label>
            <DraftField
              key={`${design.id}-frontHeightPercent-${design.frontHeightPercent}`}
              label={t('drawer.frontHeight')}
              numeric
              unit="%"
              value={design.frontHeightPercent}
              onCommit={(value) =>
                updateFront({ frontHeightPercent: Number(value) })
              }
            />
            <h3 className="eyebrow dimension-heading">
              {t('drawer.clearances')}
            </h3>
            {clearanceFields.map((field) => (
              <DraftField
                key={`${design.id}-${field}-${design[field]}`}
                label={t(`drawerField.${field}`)}
                numeric
                value={design[field]}
                onCommit={(value) => update({ [field]: Number(value) })}
              />
            ))}
            <p className="inspector-note muted">
              {t('drawer.note', { minimum: MIN_DRAWER_SIDE_CLEARANCE })}
            </p>
            {blockedByDoor && (
              <p className="field-error">{t('drawer.doorBlocks')}</p>
            )}
            {fitIssues.map((issue, index) => (
              <p key={index} className="field-error">
                {targets.length > 1
                  ? t('drawer.spacePrefix', { n: issue.target })
                  : ''}
                {drawerIssueMessage(issue)}
              </p>
            ))}
            <div className="context-actions">
              {!library && (
                <button
                  className="pill primary"
                  disabled={
                    !module ||
                    !targets.length ||
                    blockedByDoor ||
                    fitIssues.length > 0
                  }
                  onClick={apply}
                >
                  {t('drawer.apply', { target: targetLabel })}
                </button>
              )}
              <button
                className="pill"
                onClick={() =>
                  create({
                    ...designInput(design),
                    name: uniqueDesignName(
                      project,
                      t('drawer.copyName', { name: design.name }),
                    ),
                  })
                }
              >
                {t('drawer.duplicate')}{' '}
              </button>
            </div>
            <div className="inspector-actions">
              <button
                className="delete-button"
                disabled={usage > 0}
                title={usage > 0 ? t('drawer.deleteBlocked') : undefined}
                onClick={() => {
                  if (
                    run(() =>
                      execute((project) =>
                        deleteDrawerDesign(project, design.id),
                      ),
                    )
                  )
                    selectDesign(null)
                }}
              >
                {t('drawer.deleteDesign')}{' '}
              </button>
            </div>
            {usage > 0 && (
              <p className="inspector-note muted">{t('drawer.inUseNote')}</p>
            )}
          </>
        ) : (
          <div className="inspector-empty">
            <h2>{t('drawer.noneTitle')}</h2>
            <p className="muted">{t('drawer.noneBody')}</p>
          </div>
        )}
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
      </aside>
    </section>
  )
}
