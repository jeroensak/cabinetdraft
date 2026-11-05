import { useState, type FormEvent } from 'react'
import { designTemplates } from '../../design-templates'
import { useProjectStore } from '../../store/projectStore'

export function NewDesignDialog({ onClose }: { onClose(): void }) {
  const createDesign = useProjectStore((state) => state.createDesign)
  const [templateId, setTemplateId] = useState(designTemplates[0]?.id)
  const [name, setName] = useState('')
  const [failed, setFailed] = useState(false)
  const template = designTemplates.find((item) => item.id === templateId)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!template) return
    if (createDesign(template.raw, name)) onClose()
    else setFailed(true)
  }
  return (
    <div className="dialog-backdrop">
      <form
        className="new-design-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-design-title"
        onSubmit={submit}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose()
        }}
      >
        <h2 id="new-design-title">New design</h2>
        <label className="property-field">
          <span>Name</span>
          <input
            autoFocus
            value={name}
            placeholder={template?.name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <fieldset>
          <legend>Start from</legend>
          {designTemplates.map((item) => (
            <label key={item.id} className="template-option">
              <input
                type="radio"
                name="design-template"
                checked={item.id === templateId}
                onChange={() => setTemplateId(item.id)}
              />
              {item.name}
            </label>
          ))}
        </fieldset>
        {failed && (
          <p role="alert" className="field-error">
            The design could not be saved in this browser.
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" className="pill" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="pill primary" disabled={!template}>
            Create design
          </button>
        </div>
      </form>
    </div>
  )
}
