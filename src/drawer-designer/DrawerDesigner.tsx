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
        <DrawerDesignList
          selectedId={design?.id ?? ''}
          onSelect={selectDesign}
        />
        <button
          className="add-cabinet"
          onClick={() =>
            create({
              ...defaultDrawerDesign(),
              name: uniqueDesignName(project, 'Drawer design'),
            })
          }
        >
          + New drawer design
        </button>
        <div className="sidebar-tip">
          <p className="eyebrow">Tip</p>
          <p>
            A design is shared: editing it updates every drawer that uses it.
            Width and height always follow each space.
          </p>
        </div>
      </aside>
      <div className="editor-area">
        <div className="editor-toolbar">
          <span className="muted">
            {library
              ? module
                ? `Previewed in ${module.name}`
                : 'Design library'
              : module
                ? `${module.name} · ${targetLabel}`
                : 'Cabinet unavailable'}
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
            {library
              ? design
                ? 'Add this design to a space to preview it. Its size follows the space.'
                : 'Create a drawer design to get started.'
              : targets.length === 0
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
            <DraftField
              key={`${design.id}-heightPercent-${design.heightPercent}`}
              label="Box height"
              numeric
              unit="%"
              value={design.heightPercent}
              onCommit={(value) => update({ heightPercent: Number(value) })}
            />
            {boxFields.map(([field, label]) => (
              <DraftField
                key={`${design.id}-${field}-${design[field]}`}
                label={label}
                numeric
                value={design[field]}
                onCommit={(value) => update({ [field]: Number(value) })}
              />
            ))}
            <h3 className="eyebrow dimension-heading">Drawer front</h3>
            <label className="property-field">
              <span>Style</span>
              <select
                aria-label="Front style"
                value={design.frontStyle}
                onChange={(event) =>
                  updateFront({
                    frontStyle: event.target
                      .value as DrawerDesign['frontStyle'],
                  })
                }
              >
                <option value="full">Full front</option>
                <option value="wave">Wave top</option>
              </select>
            </label>
            <label className="property-field">
              <span>Position</span>
              <select
                aria-label="Front position"
                value={design.frontMount}
                onChange={(event) =>
                  updateFront({
                    frontMount: event.target
                      .value as DrawerDesign['frontMount'],
                  })
                }
              >
                <option value="overlay">Overlay (on the cabinet front)</option>
                <option value="inset">Inset (inside the opening)</option>
              </select>
            </label>
            <DraftField
              key={`${design.id}-frontHeightPercent-${design.frontHeightPercent}`}
              label="Front height"
              numeric
              unit="%"
              value={design.frontHeightPercent}
              onCommit={(value) =>
                updateFront({ frontHeightPercent: Number(value) })
              }
            />
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
              {MIN_DRAWER_SIDE_CLEARANCE} mm per side). Box height is a
              percentage of the space’s inner height, shared by all four walls.
              The bottom slots into a groove half a wall deep in each wall,
              raised by the recess to clear the slides. Front height is a
              percentage of the front’s full height, keeping its bottom edge. An
              inset front moves the box back by its thickness.
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
                  Apply to {targetLabel}
                </button>
              )}
              <button
                className="pill"
                onClick={() =>
                  create({
                    ...designInput(design),
                    name: uniqueDesignName(project, `${design.name} copy`),
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
