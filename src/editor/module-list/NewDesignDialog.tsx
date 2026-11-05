import { useState, type FormEvent } from 'react'
import { useTranslation } from '../../i18n'
import { designTemplates, localizedTemplate } from '../../design-templates'
import type { MeasurementUnit } from '../../domain/project/units'
import { useProjectStore } from '../../store/projectStore'

export function NewDesignDialog({
  required = false,
  onClose,
}: {
  /** The app has nothing to show yet, so it can't be dismissed unless saving fails. */
  required?: boolean
  onClose(): void
}) {
  const { t } = useTranslation()

  const createDesign = useProjectStore((state) => state.createDesign)
  const [templateId, setTemplateId] = useState(designTemplates[0]?.id)
  const [name, setName] = useState('')
  const [unit, setUnit] = useState<MeasurementUnit>('mm')
  const [failed, setFailed] = useState(false)
  const template = designTemplates.find((item) => item.id === templateId)
  const closable = !required || failed
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!template) return
    if (
      createDesign(
        localizedTemplate(template.raw),
        name.trim() || t(template.key),
        unit,
      )
    )
      onClose()
    else setFailed(true)
  }
  return (
    <div className="dialog-backdrop" data-below-header={required}>
      <form
        className="new-design-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-design-title"
        onSubmit={submit}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && closable) onClose()
        }}
      >
        <h2 id="new-design-title">{t('newDesign.title')}</h2>
        <label className="property-field">
          <span>{t('newDesign.name')}</span>
          <input
            autoFocus
            value={name}
            placeholder={template && t(template.key)}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <fieldset>
          <legend>{t('newDesign.startFrom')}</legend>
          {designTemplates.map((item) => (
            <label key={item.id} className="template-option">
              <input
                type="radio"
                name="design-template"
                checked={item.id === templateId}
                onChange={() => setTemplateId(item.id)}
              />
              {t(item.key)}
            </label>
          ))}
        </fieldset>
        <label className="property-field">
          <span>{t('newDesign.units')}</span>
          <select
            aria-label={t('newDesign.units')}
            value={unit}
            onChange={(event) => setUnit(event.target.value as MeasurementUnit)}
          >
            <option value="mm">{t('unit.mm')}</option>
            <option value="inch">{t('unit.inch')}</option>
          </select>
        </label>
        <p className="muted">{t('newDesign.unitsNote')}</p>
        {failed && (
          <p role="alert" className="field-error">
            {t('newDesign.failed')}
          </p>
        )}
        <div className="dialog-actions">
          {closable && (
            <button type="button" className="pill" onClick={onClose}>
              {t('newDesign.cancel')}
            </button>
          )}
          <button type="submit" className="pill primary" disabled={!template}>
            {t('newDesign.create')}
          </button>
        </div>
      </form>
    </div>
  )
}
