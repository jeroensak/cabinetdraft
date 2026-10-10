import type { CabinetModule } from '../../domain/cabinet/types'
import type { Boundary, Front } from '../../domain/fronts/types'
import type { ProjectSettings } from '../../domain/project/types'
import { deriveFrontGeometry } from '../../domain/fronts/deriveFrontGeometry'
import { setDoorLeaves } from '../../domain/commands'
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
  const { error, run } = useCommandAction()
  const geometry = deriveFrontGeometry(module, settings, front)
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
