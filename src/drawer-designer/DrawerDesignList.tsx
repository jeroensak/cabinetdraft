import { drawerDesignUsage } from '../domain/commands'
import { useTranslation } from '../i18n'
import { useProjectStore } from '../store/projectStore'

export function DrawerDesignList({
  selectedId,
  onSelect,
}: {
  /** Omit where the list only navigates and nothing can be selected. */
  selectedId?: string
  onSelect(designId: string): void
}) {
  const { t } = useTranslation()
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
                      ? t('drawer.notUsed')
                      : t('drawer.usedBy', { count })}
                  </small>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {project.drawerDesigns.length === 0 && (
        <p className="muted sidebar-note">{t('drawer.none')}</p>
      )}
    </>
  )
}
