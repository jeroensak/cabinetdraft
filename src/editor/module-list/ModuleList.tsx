import { useProjectStore } from '../../store/projectStore'

export function ModuleList() {
  const modules = useProjectStore((state) => state.present.modules)
  const selection = useProjectStore((state) => state.editor.selection)
  const setSelection = useProjectStore((state) => state.setSelection)
  return (
    <aside className="cabinet-sidebar" aria-labelledby="cabinet-list-title">
      <h2 className="eyebrow" id="cabinet-list-title">
        Cabinets
      </h2>
      <ul className="module-list">
        {modules.map((module) => (
          <li key={module.id}>
            <button
              className="module-row"
              aria-label={`${module.name}, ${module.width} mm`}
              aria-pressed={selection?.moduleId === module.id}
              onClick={() =>
                setSelection({ type: 'module', moduleId: module.id })
              }
            >
              <span className="module-marker" aria-hidden="true">
                ⋮⋮
              </span>
              <span className="module-label">
                <strong>{module.name}</strong>
                <small>{module.width} mm</small>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {modules.length === 0 && (
        <p className="muted sidebar-note">No cabinets in this project.</p>
      )}
      <button
        className="add-cabinet"
        disabled
        title="Cabinet editing will be available soon"
      >
        + Add cabinet
      </button>
      <div className="sidebar-tip">
        <p className="eyebrow">Tip</p>
        <p>Select a cabinet to inspect its dimensions.</p>
      </div>
    </aside>
  )
}
