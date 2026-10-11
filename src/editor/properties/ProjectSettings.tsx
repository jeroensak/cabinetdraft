import { useProjectStore } from '../../store/projectStore'
import { renameProject } from '../../domain/commands'
import { DraftField } from '../../components/DraftField'
import { useCommandAction } from '../useCommandAction'

const fields = [
  ['corpusThickness', 'Corpus thickness'],
  ['backPanelThickness', 'Back thickness'],
  ['frontThickness', 'Front thickness'],
  ['frontGap', 'Front gap'],
] as const

export function ProjectSettings() {
  const project = useProjectStore((state) => state.present)
  const execute = useProjectStore((state) => state.execute)
  const updateSettings = useProjectStore((state) => state.updateSettings)
  const { error, run } = useCommandAction()
  return (
    <div>
      <DraftField
        key={`${project.id}-${project.name}`}
        label="Project name"
        value={project.name}
        onCommit={(name) =>
          run(() => execute((project) => renameProject(project, name)))
        }
      />
      {fields.map(([field, label]) => (
        <DraftField
          key={`${project.id}-${field}-${project.settings[field]}`}
          label={label}
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
        Back panel enabled
      </label>
      <p className="muted">Construction settings apply to every cabinet.</p>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </div>
  )
}
