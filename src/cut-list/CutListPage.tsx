import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { deriveCutList } from '../domain/cutlist/deriveCutList'
import { partNames } from './partNames'
import { useProjectStore } from '../store/projectStore'

export function CutListPage() {
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
    } catch {
      setDownloadError('Could not create the PDF. Please try again.')
    } finally {
      setDownloading(false)
    }
  }
  return (
    <section className="cut-list-page" aria-labelledby="cut-list-title">
      <div className="cut-list-heading">
        <div>
          <h1 id="cut-list-title">Cut List</h1>
          <p>
            {project.name} · {project.modules.length}{' '}
            {project.modules.length === 1 ? 'cabinet' : 'cabinets'}
          </p>
        </div>
        <div className="cut-list-actions">
          {result.available && (
            <span className="validation-badge" data-valid="true" role="status">
              ✓ Configuration valid
            </span>
          )}
          <button
            className="pill primary"
            onClick={() => void download()}
            disabled={
              downloading || !result.available || result.items.length === 0
            }
          >
            {downloading ? 'Creating PDF…' : 'Download PDF'}
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
            <strong>
              {result.items.length}{' '}
              {result.items.length === 1 ? 'part' : 'parts'}
            </strong>
            <span>All cabinets</span>
          </div>
          {result.items.length > 0 ? (
            <div className="cut-list-scroll">
              <table className="cut-list-table">
                <caption className="sr-only">
                  Physical panels for {project.name}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">ID</th>
                    <th scope="col">Cabinet</th>
                    <th scope="col">Part</th>
                    <th scope="col">Qty</th>
                    <th scope="col">Length (mm)</th>
                    <th scope="col">Width (mm)</th>
                    <th scope="col">Thickness (mm)</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((item, index) => (
                    <tr
                      key={item.id}
                      data-module-start={
                        index > 0 &&
                        result.items[index - 1].moduleId !== item.moduleId
                      }
                    >
                      <th scope="row">{item.id}</th>
                      <td>{item.moduleName}</td>
                      <td>{partNames[item.part]}</td>
                      <td>{item.quantity}</td>
                      <td>{item.length}</td>
                      <td>{item.width}</td>
                      <td>{item.thickness}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="cut-list-empty">
              <h2>No panels yet</h2>
              <p>Add a cabinet in the Designer to create a cut list.</p>
            </div>
          )}
          <p className="cut-list-note">
            All dimensions are in millimetres. Each row represents one physical
            panel.
          </p>
        </div>
      ) : (
        <div className="cut-list-unavailable" role="status">
          <span aria-hidden="true">!</span>
          <h2>Cut list unavailable</h2>
          <p>Resolve configuration errors in the Designer first.</p>
          <p className="muted">
            {result.issues.length} configuration{' '}
            {result.issues.length === 1 ? 'error requires' : 'errors require'}{' '}
            attention. Manufacturing dimensions are withheld until the entire
            project is valid.
          </p>
        </div>
      )}
      <footer className="cut-list-footer">
        <Link className="pill" to="/designer">
          ← Back to Designer
        </Link>
        <p>Cut list updates automatically when the design changes.</p>
      </footer>
    </section>
  )
}
