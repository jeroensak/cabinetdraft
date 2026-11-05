import { useTranslation } from '../i18n'
import { useProjectStore } from '../store/projectStore'

export function SaveStatus() {
  const { t } = useTranslation()

  const persistence = useProjectStore((state) => state.persistence)
  const retry = useProjectStore((state) => state.retrySave)
  const updatedInOtherTab = useProjectStore((state) => state.updatedInOtherTab)
  const dismiss = useProjectStore((state) => state.dismissTabUpdate)
  if (updatedInOtherTab && !persistence.loadError && !persistence.saveError)
    return (
      <div className="save-warning" role="status">
        <span>{t('save.otherTab')}</span>
        <button className="pill" onClick={dismiss}>
          {t('files.dismiss')}
        </button>
      </div>
    )
  if (!persistence.loadError && !persistence.saveError) return null
  return (
    <div className="save-warning" role="status">
      <span>
        {persistence.loadError ? t('save.loadWarning') : t('save.writeWarning')}
      </span>
      {!persistence.loadError && (
        <button className="pill" onClick={retry}>
          {t('save.retry')}
        </button>
      )}
    </div>
  )
}
