import { useProjectStore } from '../../store/projectStore'

export function PropertiesInspector() {
  const selection = useProjectStore((state) => state.editor.selection)
  const module = useProjectStore((state) =>
    state.present.modules.find((item) => item.id === selection?.moduleId),
  )
  return (
    <aside className="properties-inspector" aria-label="Properties">
      <p className="eyebrow">Cabinet</p>
      {module ? (
        <>
          <h2>{module.name}</h2>
          <p className="muted">Selected module</p>
          <label className="property-field name-field">
            Name
            <input readOnly value={module.name} />
          </label>
          <h3 className="eyebrow dimension-heading">Dimensions</h3>
          {(['width', 'height', 'depth'] as const).map((dimension) => (
            <label className="property-field" key={dimension}>
              <span className="capitalize">{dimension}</span>
              <span className="dimension-input">
                <input
                  readOnly
                  value={module[dimension]}
                  aria-label={`${dimension} (mm)`}
                />
                <span aria-hidden="true">mm</span>
              </span>
            </label>
          ))}
          <p className="inspector-note muted">
            Dimensions are read-only. Editing will be available soon. Global
            construction settings are available under Settings.
          </p>
          <div className="inspector-actions">
            <button className="pill" disabled>
              Duplicate
            </button>
            <button className="delete-button" disabled>
              Delete
            </button>
          </div>
        </>
      ) : (
        <div className="inspector-empty">
          <h2>No cabinet selected</h2>
          <p className="muted">
            Select a cabinet from the list to see its properties.
          </p>
        </div>
      )}
    </aside>
  )
}
