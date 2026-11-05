import { useEffect } from 'react'
import { useTranslation } from '../i18n'
import { deleteWithNotice, isTextEditing } from './deleteSelection'
import { hasOpenModal } from '../store/hasOpenModal'
import { ValidationIssues } from '../app/ValidationIssues'
import { useCommandAction } from './useCommandAction'
import { validateProject } from '../domain/validation/validateProject'
import { useProjectStore } from '../store/projectStore'
import { StructureCanvas } from './canvas/StructureCanvas'
import { ModuleList } from './module-list/ModuleList'
import { PropertiesInspector } from './properties/PropertiesInspector'
import { DrawerDesigner } from '../drawer-designer/DrawerDesigner'

export function DesignerPage() {
  const { t } = useTranslation()

  const { error, run } = useCommandAction()
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        hasOpenModal() ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isTextEditing(event) ||
        !['Delete', 'Backspace'].includes(event.key)
      )
        return
      const state = useProjectStore.getState()
      if (
        state.editor.drawerDesigner ||
        !state.editor.selection ||
        state.editor.selection.type === 'space' ||
        state.previewBase
      )
        return
      event.preventDefault()
      deleteWithNotice(run)
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [run])
  const project = useProjectStore((state) => state.present)
  const persistence = useProjectStore((state) => state.persistence)
  const drawerDesigner = useProjectStore((state) => state.editor.drawerDesigner)
  const issues = validateProject(project)
  const valid = issues.length === 0
  const saveStatus = persistence.loadError
    ? t('status.loadError')
    : persistence.saveError
      ? t('status.saveError')
      : persistence.unsaved
        ? t('status.unsaved')
        : t('status.saved')
  if (drawerDesigner) return <DrawerDesigner context={drawerDesigner} />
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
        <ValidationIssues project={project} issues={issues} />
        <footer className="editor-status">
          <span className="validation-badge" data-valid={valid}>
            {valid ? t('status.valid') : t('status.invalid')}
          </span>
          <span>{t('count.cabinets', { count: project.modules.length })}</span>
          <span className="save-status" role="status">
            {saveStatus}
          </span>
        </footer>
      </div>
      <PropertiesInspector />
    </section>
  )
}
