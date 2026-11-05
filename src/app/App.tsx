import { SaveStatus } from './SaveStatus'
import { RouteMetadata } from './RouteMetadata'
import { ProjectFiles } from './ProjectFiles'
import { useEffect, useState } from 'react'
import { Link, NavLink, Navigate, Outlet, Route, Routes } from 'react-router'
import { DesignerPage } from '../editor/DesignerPage'
import { CutListPage } from '../cut-list/CutListPage'
import { ProjectSettings } from '../editor/properties/ProjectSettings'
import { installHistoryShortcuts, useProjectStore } from '../store/projectStore'
import { useTranslation } from '../i18n'
import { LanguagePicker } from './LanguagePicker'

function Layout() {
  const { t } = useTranslation()

  const name = useProjectStore((state) => state.present.name)
  const canUndo = useProjectStore((state) => state.past.length > 0)
  const canRedo = useProjectStore((state) => state.future.length > 0)
  const undo = useProjectStore((state) => state.undo)
  const redo = useProjectStore((state) => state.redo)
  const [settingsOpen, setSettingsOpen] = useState(false)
  useEffect(() => installHistoryShortcuts(useProjectStore), [])

  return (
    <>
      <div className="small-screen-message">
        <strong>{t('app.name')}</strong> <h1>{t('small.title')}</h1>
        <p>{t('small.body')}</p>
        <p>{t('small.hint')}</p>
      </div>
      <div className="application-shell">
        <header className="app-header">
          <div className="project-identity">
            {' '}
            <strong>{t('app.name')}</strong>
            <span title={name}>{name}</span>
          </div>
          <nav aria-label={t('nav.main')} className="segmented navigation">
            <NavLink to="/designer">{t('nav.designer')}</NavLink>
            <NavLink to="/cut-list">{t('nav.cutList')}</NavLink>
          </nav>
          <div className="header-actions">
            <button
              className="history-button"
              aria-label={t('header.undo')}
              title={t('header.undoHint')}
              disabled={!canUndo}
              onClick={undo}
            >
              ↶
            </button>
            <button
              className="history-button"
              aria-label={t('header.redo')}
              title={t('header.redoHint')}
              disabled={!canRedo}
              onClick={redo}
            >
              ↷
            </button>
            <LanguagePicker />
            <ProjectFiles />
            <button
              className="pill primary"
              aria-expanded={settingsOpen}
              aria-controls="project-settings"
              onClick={() => setSettingsOpen(!settingsOpen)}
            >
              {' '}
              {t('header.settings')}{' '}
            </button>
          </div>
        </header>
        {settingsOpen && (
          <section
            className="settings-popover"
            id="project-settings"
            aria-label={t('settings.title')}
          >
            <div className="section-heading">
              <h2>{t('settings.title')}</h2>
              <button className="pill" onClick={() => setSettingsOpen(false)}>
                {' '}
                {t('settings.close')}{' '}
              </button>
            </div>
            <ProjectSettings />
          </section>
        )}
        <SaveStatus />
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </>
  )
}

export function App() {
  const { t } = useTranslation()

  return (
    <>
      <RouteMetadata />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/designer" replace />} />
          <Route path="designer" element={<DesignerPage />} />
          <Route path="cut-list" element={<CutListPage />} />
        </Route>
        <Route
          path="*"
          element={
            <main>
              <h1>{t('notFound.title')}</h1>
              <Link to="/designer">{t('notFound.link')}</Link>
            </main>
          }
        />
      </Routes>
    </>
  )
}
