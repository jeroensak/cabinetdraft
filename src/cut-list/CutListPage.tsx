import { useMemo, useState } from 'react'
import { useTranslation } from '../i18n'
import { Link } from 'react-router'
import { deriveCutList } from '../domain/cutlist/deriveCutList'
import { groupCutList } from './partGroups'
import { partName } from './partNames'
import { useProjectStore } from '../store/projectStore'
import { trackEvent } from '../app/analytics'

export function CutListPage() {
  const { t } = useTranslation()

  const project = useProjectStore((state) => state.present)
  const result = useMemo(() => deriveCutList(project), [project])
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const download = async () => {
    setDownloading(true)
    setDownloadError(null)
    try {
      const { downloadCutListPdf } = await import('./cutListPdf')
      await downloadCutListPdf(project)
      trackEvent('cut_list_pdf_downloaded')
    } catch {
      trackEvent('cut_list_pdf_failed')
      setDownloadError(t('cutList.pdfFailed'))
    } finally {
      setDownloading(false)
    }
  }
  return (
    <section className="cut-list-page" aria-labelledby="cut-list-title">
      <div className="cut-list-heading">
        <div>
          <h1 id="cut-list-title">{t('cutList.title')}</h1>
          <p>
            {project.name} ·{' '}
            {t('count.cabinets', { count: project.modules.length })}
          </p>
        </div>
        <div className="cut-list-actions">
          {result.available && (
            <span className="validation-badge" data-valid="true" role="status">
              {t('status.valid')}
            </span>
          )}
          <button
            className="pill primary"
            onClick={() => void download()}
            disabled={
              downloading || !result.available || result.items.length === 0
            }
          >
            {downloading ? t('cutList.creating') : t('cutList.download')}
          </button>
        </div>
      </div>
      {downloadError && (
        <p role="alert" className="field-error">
          {downloadError}
        </p>
      )}
      {result.available ? (
        <div className="cut-list-card">
          <div className="cut-list-summary">
            <strong>{t('count.parts', { count: result.items.length })}</strong>
            <span>{t('cutList.allCabinets')}</span>
          </div>
          {result.items.length > 0 ? (
            <div className="cut-list-scroll">
              {groupCutList(result.items).map((group) => (
                <section
                  key={group.id}
                  className="cut-list-group"
                  aria-labelledby={`cut-list-group-${group.id}`}
                >
                  <h2 id={`cut-list-group-${group.id}`}>
                    {group.title} <small>{group.items.length}</small>
                  </h2>
                  <table className="cut-list-table">
                    <caption className="sr-only">
                      {t('cutList.caption', {
                        group: group.title,
                        project: project.name,
                      })}
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">{t('cutList.id')}</th>
                        <th scope="col">{t('cutList.cabinet')}</th>
                        <th scope="col">{t('cutList.part')}</th>
                        <th scope="col">{t('cutList.qty')}</th>
                        <th scope="col">{t('cutList.length')}</th>
                        <th scope="col">{t('cutList.width')}</th>
                        <th scope="col">{t('cutList.thickness')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((item, index) => (
                        <tr
                          key={item.id}
                          data-module-start={
                            index > 0 &&
                            group.items[index - 1].moduleId !== item.moduleId
                          }
                        >
                          <th scope="row">{item.id}</th>
                          <td>{item.moduleName}</td>
                          <td>{partName(item)}</td>
                          <td>{item.quantity}</td>
                          <td>{item.length}</td>
                          <td>{item.width}</td>
                          <td>{item.thickness}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              ))}
            </div>
          ) : (
            <div className="cut-list-empty">
              <h2>{t('cutList.emptyTitle')}</h2>
              <p>{t('cutList.emptyBody')}</p>
            </div>
          )}
          <p className="cut-list-note">{t('cutList.note')}</p>
        </div>
      ) : (
        <div className="cut-list-unavailable" role="status">
          <span aria-hidden="true">!</span>
          <h2>{t('cutList.unavailableTitle')}</h2>
          <p>{t('cutList.unavailableBody')}</p>
          <p className="muted">
            {t('cutList.errors', { count: result.issues.length })}
          </p>
        </div>
      )}
      <footer className="cut-list-footer">
        <Link className="pill" to="/designer">
          {t('cutList.back')}
        </Link>
        <p>{t('cutList.autoUpdate')}</p>
      </footer>
    </section>
  )
}
