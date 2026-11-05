import { useEffect, useState } from 'react'
import { exportProject } from '../domain/import-export/projectJson'
import { useTranslation } from '../i18n'
import { useProjectStore } from '../store/projectStore'
import { hasSharedDesign, readSharedDesign } from './shareLink'

/** Opens a shared link as a new design, after asking, and clears it from the
 * address bar so a reload or copied URL doesn't carry it along. */
export function SharedDesign() {
  const { t } = useTranslation()
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const { hash, pathname, search } = window.location
    if (!hasSharedDesign(hash)) return
    window.history.replaceState(null, '', pathname + search)
    readSharedDesign(hash)
      .then((project) => {
        if (!window.confirm(t('share.confirm', { name: project.name }))) return
        const created = useProjectStore
          .getState()
          .createDesign(
            exportProject(project),
            project.name,
            project.settings.unit,
          )
        if (!created) setFailed(true)
      })
      .catch(() => setFailed(true))
  }, [t])
  if (!failed) return null
  return (
    <div className="file-error" role="alert">
      {t('share.invalid')}
      <button className="pill" onClick={() => setFailed(false)}>
        {t('files.dismiss')}
      </button>
    </div>
  )
}
