import type { CabinetModule } from '../../domain/cabinet/types'
import type { Boundary, Front } from '../../domain/fronts/types'
import type { ProjectSettings } from '../../domain/project/types'
import { deriveFrontGeometry } from '../../domain/fronts/deriveFrontGeometry'
import {
  applyDrawerDesign,
  removeDrawerBox,
  setDoorLeaves,
} from '../../domain/commands'
import { deriveDrawerGeometry } from '../../domain/drawers/deriveDrawerGeometry'
import { spaceRange } from '../../domain/spaces/spaceRanges'
import { useProjectStore } from '../../store/projectStore'
import { useCommandAction } from '../useCommandAction'

export function FrontProperties({
  module,
  front,
  settings,
}: {
  module: CabinetModule
  front: Front
  settings: ProjectSettings
}) {
  const execute = useProjectStore((state) => state.execute)
  const designs = useProjectStore((state) => state.present.drawerDesigns)
  const openDrawerDesigner = useProjectStore(
    (state) => state.openDrawerDesigner,
  )
  const design =
    front.type === 'drawer'
      ? designs.find((item) => item.id === front.drawerDesignId)
      : undefined
  const box =
    front.type === 'drawer' && design
      ? deriveDrawerGeometry(module, settings, front, design)
      : null
  const { error, run } = useCommandAction()
  const geometry = deriveFrontGeometry(module, settings, front, design)
  const boundaryName = (boundary: Boundary) =>
    boundary.type === 'module-bottom'
      ? 'Cabinet bottom'
      : boundary.type === 'module-top'
        ? 'Cabinet top'
        : `Shelf at ${module.shelves.find((shelf) => shelf.id === boundary.shelfId)?.bottom ?? '?'} mm`
  return (
    <>
      <h3 className="eyebrow dimension-heading">Type</h3>
      {front.type === 'door' ? (
        <label className="property-field">
          <span className="sr-only">Door leaves</span>
          <select
            aria-label="Door leaves"
            value={front.leaves}
            onChange={(event) =>
              run(() =>
                execute((project) =>
                  setDoorLeaves(
                    project,
                    module.id,
                    front.id,
                    Number(event.target.value) as 1 | 2,
                  ),
                ),
              )
            }
          >
            <option value={1}>Single door</option>
            <option value={2}>Double door</option>
          </select>
        </label>
      ) : (
        <p className="semantic-value">Drawer front</p>
      )}
      <h3 className="eyebrow dimension-heading">Coverage</h3>
      <dl className="settings-values">
        <div>
          <dt>From</dt>
          <dd>{boundaryName(front.bottomBoundary)}</dd>
        </div>
        <div>
          <dt>To</dt>
          <dd>{boundaryName(front.topBoundary)}</dd>
        </div>
      </dl>
      <h3 className="eyebrow dimension-heading">Derived size</h3>
      {geometry.issues.length > 0 && (
        <p className="field-error">
          Invalid front dimensions. Resolve the configuration before
          manufacturing.
        </p>
      )}
      <dl className="settings-values">
        <div>
          <dt>
            {front.type === 'door' && front.leaves === 2
              ? 'Each leaf'
              : 'Panel'}
          </dt>
          <dd>
            {geometry.panels[0]
              ? `${geometry.panels[0].width} × ${geometry.panels[0].length} mm`
              : 'Unavailable'}
          </dd>
        </div>
        <div>
          <dt>Thickness</dt>
          <dd>{settings.frontThickness} mm</dd>
        </div>
        <div>
          <dt>Gap</dt>
          <dd>{settings.frontGap} mm</dd>
        </div>
      </dl>
      {front.type === 'drawer' && (
        <>
          <h3 className="eyebrow dimension-heading">Drawer box</h3>
          <label className="property-field">
            <span className="sr-only">Drawer box design</span>
            <select
              aria-label="Drawer box design"
              value={front.drawerDesignId ?? ''}
              onChange={(event) => {
                const designId = event.target.value
                run(() =>
                  execute((project) =>
                    designId
                      ? applyDrawerDesign(project, designId, [
                          { moduleId: module.id, range: spaceRange(front) },
                        ])
                      : removeDrawerBox(project, module.id, front.id),
                  ),
                )
              }}
            >
              <option value="">No box (front only)</option>
              {designs.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
              {front.drawerDesignId !== undefined && !design && (
                <option value={front.drawerDesignId}>Missing design</option>
              )}
            </select>
          </label>
          {box && (
            <dl className="settings-values">
              <div>
                <dt>Box (W × H × D)</dt>
                <dd>
                  {box.width} × {box.height} × {box.depth} mm
                </dd>
              </div>
            </dl>
          )}
          {box && box.issues.length > 0 && (
            <p className="field-error">{box.issues[0].message}</p>
          )}
          <button
            className="pill"
            onClick={() =>
              openDrawerDesigner({
                moduleId: module.id,
                ranges: [spaceRange(front)],
                designId: front.drawerDesignId ?? null,
              })
            }
          >
            Open drawer designer
          </button>
        </>
      )}
      <p className="inspector-note muted">
        Shift-click adjacent spaces to create a door spanning multiple spaces.
        Use Structure to edit shelves behind fronts.
      </p>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </>
  )
}
