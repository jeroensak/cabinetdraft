import { useState } from 'react'
import { DraftField } from '../../components/DraftField'
import { renameProject } from '../../domain/commands'
import { useProjectStore } from '../../store/projectStore'
import { useCommandAction } from '../useCommandAction'
import { NewDesignDialog } from './NewDesignDialog'

export function DesignPicker() {
  const project = useProjectStore((state) => state.present)
  const designs = useProjectStore((state) => state.designs)
  const blocked = useProjectStore((state) => state.persistence.loadError)
  const execute = useProjectStore((state) => state.execute)
  const switchDesign = useProjectStore((state) => state.switchDesign)
  const deleteDesign = useProjectStore((state) => state.deleteDesign)
  const { error, run } = useCommandAction()
  const [creating, setCreating] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  // Storage can't be trusted, so nothing may be written over it from here.
  const unavailable = designs === null || blocked !== null
  const stored = designs ?? []
  const options = (
    stored.some((design) => design.id === project.id)
      ? stored
      : [...stored, project]
  ).map(({ id, name }) => ({
    id,
    name: id === project.id ? project.name : name,
  }))
  return (
    <section className="design-picker" aria-labelledby="design-picker-title">
      <h2 className="eyebrow" id="design-picker-title">
        Design
      </h2>
      <select
        aria-label="Current design"
        value={project.id}
        disabled={unavailable}
        onChange={(event) =>
          setFailure(
            switchDesign(event.target.value)
              ? null
              : 'This design could not be opened.',
          )
        }
      >
        {options.map((design) => (
          <option key={design.id} value={design.id}>
            {design.name}
          </option>
        ))}
      </select>
      <DraftField
        key={`${project.id}-${project.name}`}
        label="Design name"
        value={project.name}
        onCommit={(name) =>
          Boolean(name.trim()) &&
          run(() => execute((project) => renameProject(project, name.trim())))
        }
      />
      <button
        className="add-cabinet"
        disabled={unavailable}
        onClick={() => setCreating(true)}
      >
        + New design
      </button>
      <button
        className="delete-button design-delete"
        disabled={unavailable || options.length < 2}
        title={options.length < 2 ? 'You need at least one design' : undefined}
        onClick={() => {
          if (window.confirm(`Delete "${project.name}"? This can’t be undone.`))
            setFailure(
              deleteDesign() ? null : 'This design could not be deleted.',
            )
        }}
      >
        Delete design
      </button>
      {(error || failure) && (
        <p role="alert" className="field-error">
          {error ?? failure}
        </p>
      )}
      {unavailable && (
        <p className="muted sidebar-note">
          Saved designs can’t be read, so switching is turned off.
        </p>
      )}
      {creating && <NewDesignDialog onClose={() => setCreating(false)} />}
    </section>
  )
}
