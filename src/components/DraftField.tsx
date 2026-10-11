import { useState } from 'react'

/** Parent keys the field by entity and committed value to sync undo/external changes. */
export function DraftField({
  label,
  value,
  numeric = false,
  onCommit,
}: {
  label: string
  value: string | number
  numeric?: boolean
  onCommit: (value: string) => boolean | void
}) {
  const [draft, setDraft] = useState(String(value))
  const [error, setError] = useState(false)
  return (
    <label className="property-field">
      <span className="capitalize">{label}</span>
      <span className={numeric ? 'dimension-input' : undefined}>
        <input
          aria-label={numeric ? `${label} (mm)` : label}
          inputMode={numeric ? 'numeric' : undefined}
          value={draft}
          aria-invalid={error}
          onChange={(event) => {
            setDraft(event.target.value)
            setError(false)
          }}
          onBlur={() => {
            if (draft === String(value)) return
            if (
              numeric &&
              (!/^-?\d+$/.test(draft.trim()) ||
                !Number.isSafeInteger(Number(draft)))
            ) {
              setError(true)
              return
            }
            if (onCommit(draft) === false) setDraft(String(value))
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return
            if (event.key === 'Enter') {
              event.preventDefault()
              event.currentTarget.blur()
            }
            if (event.key === 'Escape') {
              event.preventDefault()
              setDraft(String(value))
              setError(false)
            }
          }}
        />
        {numeric && <span aria-hidden="true">mm</span>}
      </span>
      {error && (
        <span className="field-error" role="alert">
          Enter a whole number in millimetres.
        </span>
      )}
    </label>
  )
}
