import type { CabinetModule } from '../../domain/cabinet/types'
import type { Boundary, Front } from '../../domain/fronts/types'
import type { ProjectSettings } from '../../domain/project/types'
import { deriveFrontGeometry } from '../../domain/fronts/deriveFrontGeometry'
import { applyDrawerDesign, setDoorLeaves } from '../../domain/commands'
import { deriveDrawerGeometry } from '../../domain/drawers/deriveDrawerGeometry'
import { spaceRange } from '../../domain/spaces/spaceRanges'
import { useTranslation } from '../../i18n'
import { drawerIssueMessage } from '../../i18n/drawerIssues'
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
  const { t } = useTranslation()
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
      ? t('frontInfo.cabinetBottom')
      : boundary.type === 'module-top'
        ? t('frontInfo.cabinetTop')
        : t('frontInfo.shelfAt', {
            bottom:
              module.shelves.find((shelf) => shelf.id === boundary.shelfId)
                ?.bottom ?? '?',
          })
  return (
    <>
      <h3 className="eyebrow dimension-heading">{t('frontInfo.type')}</h3>
      {front.type === 'door' ? (
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
              ? `${geometry.panels[0].width} × ${geometry.panels[0].length} mm`
              : t('frontInfo.unavailable')}
          </dd>
        </div>
        <div>
          <dt>{t('frontInfo.thickness')}</dt>
          <dd>{settings.frontThickness} mm</dd>
        </div>
        <div>
          <dt>{t('frontInfo.gap')}</dt>
          <dd>{settings.frontGap} mm</dd>
        </div>
      </dl>
      {front.type === 'drawer' && (
        <>
          <h3 className="eyebrow dimension-heading">
            {t('frontInfo.drawerBox')}
          </h3>
          <label className="property-field">
            <span className="sr-only">{t('frontInfo.drawerBoxDesign')}</span>
            <select
              aria-label={t('frontInfo.drawerBoxDesign')}
              value={front.drawerDesignId ?? ''}
              onChange={(event) => {
                const designId = event.target.value
                run(() =>
                  execute((project) =>
                    applyDrawerDesign(project, designId, [
                      { moduleId: module.id, range: spaceRange(front) },
                    ]),
                  ),
                )
              }}
            >
              {designs.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
              {!design && (
                <option value={front.drawerDesignId ?? ''}>
                  {t('frontInfo.missingDesign')}
                </option>
              )}
            </select>
          </label>
          {box && (
            <dl className="settings-values">
              <div>
                <dt>{t('frontInfo.boxSize')}</dt>
                <dd>
                  {box.width} × {box.height} × {box.depth} mm
                </dd>
              </div>
            </dl>
          )}
          {box && box.issues.length > 0 && (
            <p className="field-error">{drawerIssueMessage(box.issues[0])}</p>
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
