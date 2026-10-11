import { useProjectStore } from '../store/projectStore'

export function SaveStatus() {
  const persistence = useProjectStore((state) => state.persistence)
  const retry = useProjectStore((state) => state.retrySave)
  if (!persistence.loadError && !persistence.saveError) return null
  return (
    <div className="save-warning" role="status">
      <span>
        {persistence.loadError
          ? 'Local storage could not be loaded. Autosave is paused; export your work to keep a copy.'
          : 'Changes could not be saved locally. Export your work or retry saving.'}
      </span>
      {!persistence.loadError && (
        <button className="pill" onClick={retry}>
          Retry saving
        </button>
      )}
    </div>
  )
}
