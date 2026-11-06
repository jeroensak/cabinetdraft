import { SaveStatus } from './SaveStatus'
import { RouteMetadata } from './RouteMetadata'
import { ProjectFiles } from './ProjectFiles'
import { SharedDesign } from './SharedDesign'

import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Navigate, Outlet, Route, Routes } from 'react-router'
import { DesignerPage } from '../editor/DesignerPage'
import { NewDesignDialog } from '../editor/module-list/NewDesignDialog'
import { CutListPage } from '../cut-list/CutListPage'
import { ProjectSettings } from '../editor/properties/ProjectSettings'
import {
  installHistoryShortcuts,
  installTabSync,
  useProjectStore,
} from '../store/projectStore'
import { UndoNotice } from './UndoNotice'
import { useTranslation } from '../i18n'
import { LanguagePicker } from './LanguagePicker'

function Layout() {
  const { t } = useTranslation()

  const name = useProjectStore((state) => state.present.name)
  const canUndo = useProjectStore((state) => state.past.length > 0)
  const canRedo = useProjectStore((state) => state.future.length > 0)
  const undo = useProjectStore((state) => state.undo)
  const redo = useProjectStore((state) => state.redo)
  const needsFirstDesign = useProjectStore((state) => state.needsFirstDesign)
  const skipFirstDesign = useProjectStore((state) => state.skipFirstDesign)
  const [settingsOpen, setSettingsOpen] = useState(false)
  useEffect(() => installHistoryShortcuts(useProjectStore), [])
  useEffect(() => installTabSync(useProjectStore), [])
  const settingsPanel = useRef<HTMLElement>(null)
  const settingsButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!settingsOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSettingsOpen(false)
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (
        !settingsPanel.current?.contains(target) &&
        !settingsButton.current?.contains(target)
      )
        setSettingsOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [settingsOpen])

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
            <strong>{t('app.name')}</strong>
            {!needsFirstDesign && <span title={name}>{name}</span>}
          </div>
          {needsFirstDesign ? (
            <span />
          ) : (
            <nav aria-label={t('nav.main')} className="segmented navigation">
              <NavLink to="/designer">{t('nav.designer')}</NavLink>
              <NavLink to="/cut-list">{t('nav.cutList')}</NavLink>
            </nav>
          )}
          <div className="header-actions">
            {!needsFirstDesign && (
              <>
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
              </>
            )}
            <ProjectFiles firstVisit={needsFirstDesign} />
            {!needsFirstDesign && (
              <button
                ref={settingsButton}
                className="header-icon-button"
                aria-label={t('header.settings')}
                title={t('header.settings')}
                aria-expanded={settingsOpen}
                aria-controls="project-settings"
                onClick={() => setSettingsOpen(!settingsOpen)}
              >
                <svg
                  className="header-icon"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
            )}
            <LanguagePicker />
          </div>
        </header>
        {settingsOpen && (
          <section
            className="settings-popover"
            ref={settingsPanel}
            id="project-settings"
            aria-label={t('settings.title')}
          >
            <div className="section-heading">
              <h2>{t('settings.title')}</h2>
              <button className="pill" onClick={() => setSettingsOpen(false)}>
                {t('settings.close')}
              </button>
            </div>
            <ProjectSettings />
          </section>
        )}
        <SaveStatus />
        <UndoNotice />
        <SharedDesign />
        <main className="app-main">{!needsFirstDesign && <Outlet />}</main>
        {needsFirstDesign && (
          <NewDesignDialog required onClose={skipFirstDesign} />
        )}
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
