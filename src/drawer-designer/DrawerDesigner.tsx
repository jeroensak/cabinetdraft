import { useState } from 'react'
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
import { DrawerPreview } from './DrawerPreview'

type MeasurementField = Exclude<
  keyof DrawerDesignInput,
  'name' | 'slideType' | 'height'
>
const boxFields: [MeasurementField, string][] = [
  ['wallThickness', 'Wall thickness'],
  ['bottomThickness', 'Bottom thickness'],
  ['depth', 'Box depth'],
]
const clearanceFields: [MeasurementField, string][] = [
  ['sideClearance', 'Side gap (each side)'],
  ['bottomClearance', 'Gap below box'],
  ['topClearance', 'Gap above box'],
  ['rearClearance', 'Gap behind box'],
  ['bottomRecess', 'Bottom recess'],
]

function designInput(design: DrawerDesign): DrawerDesignInput {
  const input: Partial<DrawerDesign> = { ...design }
  delete input.id
  return input as DrawerDesignInput
}

function uniqueName(project: Project, base: string) {
  const names = new Set(project.drawerDesigns.map((design) => design.name))
  if (!names.has(base)) return base
  let index = 2
  while (names.has(`${base} ${index}`)) index++
  return `${base} ${index}`
}

/** Targets are stable ranges; spaces/fronts are re-derived on every render. */
function resolveTargets(project: Project, context: DrawerDesignerState) {
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
  const project = useProjectStore((state) => state.present)
  const execute = useProjectStore((state) => state.execute)
  const close = useProjectStore((state) => state.closeDrawerDesigner)
  const selectDesign = useProjectStore((state) => state.selectDrawerDesign)
  const { error, run } = useCommandAction()
  const [showFront, setShowFront] = useState(false)
  const { module, targets } = resolveTargets(project, context)
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
  const targetLabel =
    targets.length === 1
      ? '1 selected space'
      : `${targets.length} selected spaces`
  return (
    <section
      className="designer-layout drawer-designer"
      aria-labelledby="drawer-designer-title"
    >
      <aside className="cabinet-sidebar" aria-label="Drawer designs">
        <button className="pill mb-4" onClick={close}>
          ← Back to cabinet
        </button>
        <p className="eyebrow">Drawer designer</p>
        <h2 id="drawer-designer-title">Drawer designs</h2>
        <ul className="module-list">
          {project.drawerDesigns.map((item) => {
            const count = drawerDesignUsage(project, item.id)
            return (
              <li key={item.id}>
                <button
                  className="module-row"
                  aria-pressed={item.id === design?.id}
                  onClick={() => selectDesign(item.id)}
                >
                  <span className="module-label">
                    <strong>{item.name}</strong>
                    <small>
                      {count === 0
                        ? 'Not used yet'
                        : `Used by ${count} ${count === 1 ? 'drawer' : 'drawers'}`}
                    </small>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        {project.drawerDesigns.length === 0 && (
          <p className="muted sidebar-note">
            No drawer designs yet. Create one to reuse it across spaces.
          </p>
        )}
        <button
          className="add-cabinet"
          onClick={() =>
            create({
              ...defaultDrawerDesign(),
              name: uniqueName(project, 'Drawer design'),
            })
          }
        >
          + New drawer design
        </button>
        <div className="sidebar-tip">
          <p className="eyebrow">Tip</p>
          <p>
            A design is shared: editing it updates every drawer that uses it.
            Width always follows each space.
          </p>
        </div>
      </aside>
      <div className="editor-area">
        <div className="editor-toolbar">
          <span className="muted">
            {module ? `${module.name} · ${targetLabel}` : 'Cabinet unavailable'}
            {preview &&
              ` · opening ${preview.openingWidth} × ${preview.openingHeight} mm`}
          </span>
          <label className="drawer-front-toggle">
            <input
              type="checkbox"
              checked={showFront}
              onChange={(event) => setShowFront(event.target.checked)}
            />
            Show drawer front
          </label>
        </div>
        {preview ? (
          <DrawerPreview geometry={preview} showFront={showFront} />
        ) : (
          <div className="drawer-preview-empty muted">
            {targets.length === 0
              ? 'The selected space is no longer available. Go back and select a space.'
              : 'Create a drawer design to preview it in this space.'}
          </div>
        )}
        <footer className="editor-status">
          {preview && (
            <span className="validation-badge" data-valid={!fitIssues.length}>
              {fitIssues.length ? '! Does not fit' : '✓ Fits'}
            </span>
          )}
          {preview && (
            <span>
              Box {preview.width} × {preview.height} × {preview.depth} mm (W × H
              × D)
            </span>
          )}
        </footer>
      </div>
      <aside className="properties-inspector" aria-label="Drawer design">
        {design ? (
          <>
            <p className="eyebrow">Drawer design</p>
            <h2>{design.name}</h2>
            <p className="muted">
              {usage === 0
                ? 'Not used by any drawer yet'
                : `Shared by ${usage} ${usage === 1 ? 'drawer' : 'drawers'}`}
            </p>
            <DraftField
              key={`${design.id}-name-${design.name}`}
              label="Name"
              value={design.name}
              onCommit={(name) => update({ name: name.trim() })}
            />
            <h3 className="eyebrow dimension-heading">Slides</h3>
            <p className="semantic-value">Undermount</p>
            <h3 className="eyebrow dimension-heading">Box</h3>
            <label className="property-field">
              <span>Side height</span>
              <select
                aria-label="Side height"
                value={design.height === null ? 'auto' : 'fixed'}
                onChange={(event) =>
                  update({
                    height:
                      event.target.value === 'auto'
                        ? null
                        : (preview?.height ?? 150),
                  })
                }
              >
                <option value="auto">Half of the space height</option>
                <option value="fixed">Fixed height</option>
              </select>
            </label>
            {design.height !== null && (
              <DraftField
                key={`${design.id}-height-${design.height}`}
                label="Fixed height"
                numeric
                value={design.height}
                onCommit={(value) => update({ height: Number(value) })}
              />
            )}
            {boxFields.map(([field, label]) => (
              <DraftField
                key={`${design.id}-${field}-${design[field]}`}
                label={label}
                numeric
                value={design[field]}
                onCommit={(value) => update({ [field]: Number(value) })}
              />
            ))}
            <h3 className="eyebrow dimension-heading">Clearances</h3>
            {clearanceFields.map(([field, label]) => (
              <DraftField
                key={`${design.id}-${field}-${design[field]}`}
                label={label}
                numeric
                value={design[field]}
                onCommit={(value) => update({ [field]: Number(value) })}
              />
            ))}
            <p className="inspector-note muted">
              Box width = opening width − 2 × side gap (at least{' '}
              {MIN_DRAWER_SIDE_CLEARANCE} mm per side). All four walls share one
              height; the bottom sits between them, raised by the recess to
              clear the slides.
            </p>
            {blockedByDoor && (
              <p className="field-error">
                A door covers one of the selected spaces. Remove it before
                adding a drawer.
              </p>
            )}
            {fitIssues.map((issue, index) => (
              <p key={index} className="field-error">
                {targets.length > 1 ? `Space ${issue.target}: ` : ''}
                {issue.message}
              </p>
            ))}
            <div className="context-actions">
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
                Apply to {targetLabel}
              </button>
              <button
                className="pill"
                onClick={() =>
                  create({
                    ...designInput(design),
                    name: uniqueName(project, `${design.name} copy`),
                  })
                }
              >
                Duplicate
              </button>
            </div>
            <div className="inspector-actions">
              <button
                className="delete-button"
                disabled={usage > 0}
                title={
                  usage > 0
                    ? 'Remove this design from its drawers first'
                    : undefined
                }
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
                Delete design
              </button>
            </div>
            {usage > 0 && (
              <p className="inspector-note muted">
                Designs in use can’t be deleted. Remove the box from those
                drawers in Fronts view first.
              </p>
            )}
          </>
        ) : (
          <div className="inspector-empty">
            <h2>No drawer design</h2>
            <p className="muted">
              Create a drawer design: four equal-height walls, a bottom, and an
              overlay front on undermount slides.
            </p>
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
