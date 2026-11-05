import { useTranslation } from '../../i18n'
import { useMeasure } from '../../units/useMeasure'

import { useProjectStore } from '../../store/projectStore'
import { DraftField } from '../../components/DraftField'
import { useCommandAction } from '../useCommandAction'

const fields = [
  ['corpusThickness', 'settings.corpusThickness'],
  ['backPanelThickness', 'settings.backThickness'],
  ['frontThickness', 'settings.frontThickness'],
  ['frontGap', 'settings.frontGap'],
] as const

export function ProjectSettings() {
  const { t } = useTranslation()
  const { unit } = useMeasure()

  const project = useProjectStore((state) => state.present)
  const updateSettings = useProjectStore((state) => state.updateSettings)
  const { error, run } = useCommandAction()
  return (
    <div>
      {fields.map(([field, label]) => (
        <DraftField
          key={`${project.id}-${field}-${project.settings[field]}`}
          label={t(label)}
          numeric
          value={project.settings[field]}
          onCommit={(value) =>
            run(() => updateSettings({ [field]: Number(value) }))
          }
        />
      ))}
      <label className="settings-checkbox">
        <input
          type="checkbox"
          checked={project.settings.backPanelEnabled}
          onChange={(event) =>
            run(() =>
              updateSettings({ backPanelEnabled: event.target.checked }),
            )
          }
        />
        {t('settings.backEnabled')}
      </label>
      <dl className="settings-values">
        <div>
          <dt>{t('settings.units')}</dt>
          <dd>{t(unit === 'inch' ? 'unit.inch' : 'unit.mm')}</dd>
        </div>
      </dl>
      <p className="muted">{t('settings.note')}</p>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </div>
  )
}
