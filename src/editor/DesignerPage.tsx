import { useEffect } from 'react'
import { deleteSelection, isTextEditing } from './deleteSelection'
import { useCommandAction } from './useCommandAction'
import { validateProject } from '../domain/validation/validateProject'
import { useProjectStore } from '../store/projectStore'
import { StructureCanvas } from './canvas/StructureCanvas'
import { ModuleList } from './module-list/ModuleList'
import { PropertiesInspector } from './properties/PropertiesInspector'

export function DesignerPage() {
  const { error, run } = useCommandAction()
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isTextEditing(event) ||
        !['Delete', 'Backspace'].includes(event.key)
      )
        return
      const state = useProjectStore.getState()
      if (
        !state.editor.selection ||
        state.editor.selection.type === 'space' ||
        state.previewBase
      )
        return
      event.preventDefault()
      run(() =>
        state.execute((project) =>
          deleteSelection(project, state.editor.selection),
        ),
      )
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [run])
  const project = useProjectStore((state) => state.present)
  const persistence = useProjectStore((state) => state.persistence)
  const valid = validateProject(project).length === 0
  const saveStatus = persistence.loadError
    ? 'Saved project could not be loaded. Autosave paused.'
    : persistence.saveError
      ? 'Changes could not be saved.'
      : persistence.unsaved
        ? 'Not yet saved'
        : 'Saved locally'
  return (
    <section className="designer-layout" aria-labelledby="designer-title">
      <ModuleList />
      <div className="editor-area">
        <StructureCanvas />
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
        <footer className="editor-status">
          <span className="validation-badge" data-valid={valid}>
            {valid ? '✓ Configuration valid' : '! Invalid geometry'}
          </span>
          <span>
            {project.modules.length}{' '}
            {project.modules.length === 1 ? 'cabinet' : 'cabinets'}
          </span>
          <span className="save-status" role="status">
            {saveStatus}
          </span>
        </footer>
      </div>
      <PropertiesInspector />
    </section>
  )
}
