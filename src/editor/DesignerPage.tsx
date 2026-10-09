import { validateProject } from '../domain/validation/validateProject'
import { useProjectStore } from '../store/projectStore'
import { ModuleList } from './module-list/ModuleList'
import { PropertiesInspector } from './properties/PropertiesInspector'

export function DesignerPage() {
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
        <div className="editor-toolbar">
          <span className="muted">
            {project.modules
              .reduce((total, module) => total + module.width, 0)
              .toLocaleString('en-US')}{' '}
            mm total width
          </span>
          <div className="segmented view-switch" aria-label="Designer view">
            <button disabled className="selected">
              Structure
            </button>
            <button disabled>Fronts</button>
          </div>
          <div className="canvas-controls">
            <div className="zoom-control">
              <button disabled aria-label="Zoom out">
                −
              </button>
              <span>100%</span>
              <button disabled aria-label="Zoom in">
                +
              </button>
            </div>
            <button className="pill" disabled>
              Fit to view
            </button>
          </div>
        </div>
        <div className="canvas-placeholder">
          <h1 id="designer-title">Designer</h1>
          <p>The cabinet visualization will appear here.</p>
          <p>Select a cabinet to inspect its dimensions.</p>
        </div>
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
