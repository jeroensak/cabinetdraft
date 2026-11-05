import { drawerDesignUsage } from '../domain/commands'
import { useProjectStore } from '../store/projectStore'

export function DrawerDesignList({
  selectedId,
  onSelect,
}: {
  /** Omit where the list only navigates and nothing can be selected. */
  selectedId?: string
  onSelect(designId: string): void
}) {
  const project = useProjectStore((state) => state.present)
  return (
    <>
      <ul className="module-list">
        {project.drawerDesigns.map((item) => {
          const count = drawerDesignUsage(project, item.id)
          return (
            <li key={item.id}>
              <button
                className="module-row"
                aria-pressed={selectedId ? item.id === selectedId : undefined}
                onClick={() => onSelect(item.id)}
              >
                <span className="module-label">
                  <strong>{item.name}</strong>
                  <small>
                    {count === 0
                      ? 'Not used yet'
                      : `Used by ${count} ${count === 1 ? 'drawer' : 'drawers'}`}
                  </small>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {project.drawerDesigns.length === 0 && (
        <p className="muted sidebar-note">
          No drawer designs yet. Create one to reuse it across spaces.
        </p>
      )}
    </>
  )
}
