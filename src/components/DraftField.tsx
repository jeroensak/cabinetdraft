import { useState } from 'react'
import { useTranslation } from '../i18n'
import { formatInches, parseInches, unitSymbol } from '../units'
import { useMeasure } from '../units/useMeasure'

const wholeNumber = (text: string) =>
  /^-?\d+$/.test(text.trim()) && Number.isSafeInteger(Number(text))
    ? Number(text)
    : null

/** Parent keys the field by entity and committed value to sync undo/external changes. */
export function DraftField({
  label,
  value,
  numeric = false,
  percent = false,
  onCommit,
}: {
  label: string
  value: string | number
  numeric?: boolean
  /** A whole percentage instead of a size in the design's unit. */
  percent?: boolean
  onCommit: (value: string) => boolean | void
}) {
  const { t } = useTranslation()
  const designUnit = useMeasure().unit
  const inch = numeric && !percent && designUnit === 'inch'
  const shown = inch ? formatInches(Number(value)) : String(value)
  const symbol = percent ? '%' : unitSymbol(designUnit)
  const [draft, setDraft] = useState(shown)
  const [error, setError] = useState(false)
  return (
    <label className="property-field">
      <span className="block first-letter:uppercase">{label}</span>
      <span className={numeric ? 'dimension-input' : undefined}>
        <input
          aria-label={numeric ? `${label} (${symbol})` : label}
          inputMode={numeric && !inch ? 'numeric' : undefined}
          value={draft}
          aria-invalid={error}
          onChange={(event) => {
            setDraft(event.target.value)
            setError(false)
          }}
          onBlur={() => {
            if (draft === shown) return
            const parsed = inch ? parseInches(draft) : wholeNumber(draft)
            if (numeric && parsed === null) {
              setError(true)
              return
            }
            const next = numeric ? String(parsed) : draft
            if (onCommit(next) === false) setDraft(shown)
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return
            if (event.key === 'Enter') {
              event.preventDefault()
              event.currentTarget.blur()
            }
            if (event.key === 'Escape') {
              event.preventDefault()
              setDraft(shown)
              setError(false)
            }
          }}
        />
        {numeric && <span aria-hidden="true">{symbol}</span>}
      </span>
      {error && (
        <span className="field-error" role="alert">
          {percent
            ? t('field.whole')
            : inch
              ? t('field.inches')
              : t('field.wholeMm')}
        </span>
      )}
    </label>
  )
}
