import { useState } from 'react'
import { useTranslation } from '../../i18n'
import { DraftField } from '../../components/DraftField'
import { renameProject } from '../../domain/commands'
import { useProjectStore } from '../../store/projectStore'
import { useCommandAction } from '../useCommandAction'
import { NewDesignDialog } from './NewDesignDialog'

export function DesignPicker() {
  const { t } = useTranslation()

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
        {t('design.heading')}
      </h2>
      <select
        aria-label={t('design.current')}
        value={project.id}
        disabled={unavailable}
        onChange={(event) =>
          setFailure(
            switchDesign(event.target.value) ? null : t('design.openFailed'),
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
        label={t('design.name')}
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
        {t('design.new')}
      </button>
      <button
        className="delete-button design-delete"
        disabled={unavailable || options.length < 2}
        title={options.length < 2 ? t('design.keepOne') : undefined}
        onClick={() => {
          if (window.confirm(t('design.confirmDelete', { name: project.name })))
            setFailure(deleteDesign() ? null : t('design.deleteFailed'))
        }}
      >
        {t('design.delete')}
      </button>
      {(error || failure) && (
        <p role="alert" className="field-error">
          {error ?? failure}
        </p>
      )}
      {unavailable && (
        <p className="muted sidebar-note">{t('design.unreadable')}</p>
      )}
      {creating && <NewDesignDialog onClose={() => setCreating(false)} />}
    </section>
  )
}
