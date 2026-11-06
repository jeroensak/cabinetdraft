import type { CabinetModule } from '../../domain/cabinet/types'
import type { Boundary, Front } from '../../domain/fronts/types'
import type { ProjectSettings } from '../../domain/project/types'
import { deriveFrontGeometry } from '../../domain/fronts/deriveFrontGeometry'
import { setDoorLeaves } from '../../domain/commands'
import { deriveDrawerGeometry } from '../../domain/drawers/deriveDrawerGeometry'
import { spaceRange } from '../../domain/spaces/spaceRanges'
import { useTranslation } from '../../i18n'
import { useMeasure } from '../../units/useMeasure'

import { drawerIssueMessage } from '../../i18n/drawerIssues'
import { useProjectStore } from '../../store/projectStore'
import { useCommandAction } from '../useCommandAction'
import { DoorMountField, DrawerDesignField } from './FrontChoices'

export function FrontProperties({
  module,
  front,
  settings,
}: {
  module: CabinetModule
  front: Front
  settings: ProjectSettings
}) {
  const { t } = useTranslation()
  const { measure, size, unit } = useMeasure()

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
  const shelfAt = (shelfId: string) => {
    const shelf = module.shelves.find((item) => item.id === shelfId)
    return t('frontInfo.shelfAt', {
      bottom: shelf ? measure(shelf.bottom) : '?',
    })
  }
  const boundaryName = (boundary: Boundary) =>
    boundary.type === 'module-bottom'
      ? t('frontInfo.cabinetBottom')
      : boundary.type === 'module-top'
        ? t('frontInfo.cabinetTop')
        : shelfAt(boundary.shelfId)
  return (
    <>
      <h3 className="eyebrow dimension-heading">{t('frontInfo.type')}</h3>
      {front.type === 'door' ? (
        <>
          <label className="property-field">
            <span className="sr-only">{t('frontInfo.doorLeaves')}</span>
            <select
              aria-label={t('frontInfo.doorLeaves')}
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
              <option value={1}>{t('front.single')}</option>
              <option value={2}>{t('front.double')}</option>
            </select>
          </label>
          <DoorMountField moduleId={module.id} door={front} run={run} />
        </>
      ) : (
        <p className="semantic-value">{t('front.drawer')}</p>
      )}
      <h3 className="eyebrow dimension-heading">{t('frontInfo.coverage')}</h3>
      <dl className="settings-values">
        <div>
          <dt>{t('frontInfo.from')}</dt>
          <dd>{boundaryName(front.bottomBoundary)}</dd>
        </div>
        <div>
          <dt>{t('frontInfo.to')}</dt>
          <dd>{boundaryName(front.topBoundary)}</dd>
        </div>
      </dl>
      <h3 className="eyebrow dimension-heading">
        {t('frontInfo.derivedSize')}
      </h3>
      {geometry.issues.length > 0 && (
        <p className="field-error">{t('frontInfo.invalid')}</p>
      )}
      <dl className="settings-values">
        <div>
          <dt>
            {front.type === 'door' && front.leaves === 2
              ? t('frontInfo.eachLeaf')
              : t('frontInfo.panel')}
          </dt>
          <dd>
            {geometry.panels[0]
              ? size(geometry.panels[0].width, geometry.panels[0].length)
              : t('frontInfo.unavailable')}
          </dd>
        </div>
        <div>
          <dt>{t('frontInfo.thickness')}</dt>
          <dd>{measure(settings.frontThickness)}</dd>
        </div>
        <div>
          <dt>{t('frontInfo.gap')}</dt>
          <dd>{measure(settings.frontGap)}</dd>
        </div>
      </dl>
      {front.type === 'drawer' && (
        <>
          <h3 className="eyebrow dimension-heading">
            {t('frontInfo.drawerBox')}
          </h3>
          <DrawerDesignField moduleId={module.id} drawer={front} run={run} />
          {box && (
            <dl className="settings-values">
              <div>
                <dt>{t('frontInfo.boxSize')}</dt>
                <dd>{size(box.width, box.height, box.depth)}</dd>
              </div>
            </dl>
          )}
          {box && box.issues.length > 0 && (
            <p className="field-error">
              {drawerIssueMessage(box.issues[0], unit)}
            </p>
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
            {t('frontInfo.openDesigner')}
          </button>
        </>
      )}
      <p className="inspector-note muted">{t('frontInfo.note')}</p>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </>
  )
}
