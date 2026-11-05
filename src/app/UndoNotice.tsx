import { useEffect } from 'react'
import { useTranslation } from '../i18n'
import { useProjectStore } from '../store/projectStore'

const VISIBLE_MS = 8000

/** Deleting a cabinet asks nothing first, so the way back stays in view. */
export function UndoNotice() {
  const { t } = useTranslation()
  const notice = useProjectStore((state) => state.notice)
  const setNotice = useProjectStore((state) => state.setNotice)
  const undo = useProjectStore((state) => state.undo)
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [notice, setNotice])
  if (!notice) return null
  return (
    <div className="undo-notice" role="status">
      <span>{notice}</span>
      <button
        className="pill"
        onClick={() => {
          undo()
          setNotice(null)
        }}
      >
        {t('header.undo')}
      </button>
    </div>
  )
}
