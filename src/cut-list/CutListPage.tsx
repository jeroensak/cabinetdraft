import { useMemo, useState } from 'react'
import { useTranslation } from '../i18n'
import { formatBare, formatTotalLength, unitSymbol } from '../units'
import { useMeasure } from '../units/useMeasure'

import { Link } from 'react-router'
import { deriveCutList } from '../domain/cutlist/deriveCutList'
import { deriveEdgeBanding } from '../domain/cutlist/edgeBanding'
import { cutListRows, groupCutList } from './partGroups'
import { bandedEdgesLabel, bandingNote } from './partNames'
import { useProjectStore } from '../store/projectStore'
import { trackEvent } from '../app/analytics'
import { ValidationIssues } from '../app/ValidationIssues'
import { SheetLayoutView } from './SheetLayoutView'

export function CutListPage() {
  const { t } = useTranslation()
  const { unit } = useMeasure()
  const symbol = unitSymbol(unit)

  const project = useProjectStore((state) => state.present)
  const result = useMemo(() => deriveCutList(project), [project])
  const banding = useMemo(
    () =>
      result.available
        ? deriveEdgeBanding(project.settings, result.items)
        : null,
    [project.settings, result],
  )
  const [merged, setMerged] = useState(true)
  const [view, setView] = useState<'parts' | 'sheets'>('parts')
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const download = async () => {
    setDownloading(true)
    setDownloadError(null)
    try {
      const { downloadCutListPdf } = await import('./cutListPdf')
      await downloadCutListPdf(project, merged)
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
            {result.items.length > 0 && (
              <div
                className="segmented view-switch cut-list-view"
                role="group"
                aria-label={t('cutList.viewLabel')}
              >
                {(['parts', 'sheets'] as const).map((option) => (
                  <button
                    key={option}
                    aria-pressed={view === option}
                    className={view === option ? 'selected' : undefined}
                    onClick={() => setView(option)}
                  >
                    {t(`cutList.${option}View`)}
                  </button>
                ))}
              </div>
            )}
            {view === 'parts' && (
              <label className="cut-list-merge">
                <input
                  type="checkbox"
                  checked={merged}
                  onChange={(event) => setMerged(event.target.checked)}
                />
                {t('cutList.mergeIdentical')}
              </label>
            )}
            <span>{t('cutList.allCabinets')}</span>
          </div>
          {result.items.length === 0 ? (
            <div className="cut-list-empty">
              <h2>{t('cutList.emptyTitle')}</h2>
              <p>{t('cutList.emptyBody')}</p>
            </div>
          ) : view === 'sheets' ? (
            <SheetLayoutView key={unit} items={result.items} />
          ) : (
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
                        <th scope="col">
                          {t('cutList.length', { unit: symbol })}
                        </th>
                        <th scope="col">
                          {t('cutList.width', { unit: symbol })}
                        </th>
                        <th scope="col">
                          {t('cutList.thickness', { unit: symbol })}
                        </th>
                        {banding && <th scope="col">{t('cutList.banding')}</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {cutListRows(group.items, unit, merged).map(
                        (row, index, rows) => (
                          <tr
                            key={row.ids[0]}
                            data-module-start={
                              index > 0 &&
                              rows[index - 1].moduleId !== row.moduleId
                            }
                          >
                            <th scope="row">{row.ids.join(', ')}</th>
                            <td>{row.cabinets.join(', ')}</td>
                            <td>{row.name}</td>
                            <td>{row.quantity}</td>
                            <td>{formatBare(row.length, unit)}</td>
                            <td>{formatBare(row.width, unit)}</td>
                            <td>{formatBare(row.thickness, unit)}</td>
                            {banding && <td>{bandedEdgesLabel(row)}</td>}
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </section>
              ))}
            </div>
          )}
          {view === 'parts' && banding && result.items.length > 0 && (
            <div className="cut-list-banding">
              <strong>
                {t('cutList.bandingTotal', {
                  length: formatTotalLength(banding.totalLength, unit),
                })}
              </strong>
              <span>{bandingNote(banding, unit)}</span>
            </div>
          )}
          {view === 'parts' && (
            <p className="cut-list-note">
              {t(merged ? 'cutList.noteMerged' : 'cutList.note', {
                unit: t(unit === 'inch' ? 'unit.inchPlural' : 'unit.mmPlural'),
              })}
            </p>
          )}
        </div>
      ) : (
        <div className="cut-list-unavailable" role="status">
          <span aria-hidden="true">!</span>
          <h2>{t('cutList.unavailableTitle')}</h2>
          <p>{t('cutList.unavailableBody')}</p>
          <p className="muted">
            {t('cutList.errors', { count: result.issues.length })}
          </p>
          <ValidationIssues project={project} issues={result.issues} />{' '}
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
