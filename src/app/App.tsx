import { ProjectFiles } from './ProjectFiles'
import { useEffect, useState } from 'react'
import { NavLink, Navigate, Outlet, Route, Routes } from 'react-router'
import { DesignerPage } from '../editor/DesignerPage'
import { CutListPage } from '../cut-list/CutListPage'
import { ProjectSettings } from '../editor/properties/ProjectSettings'
import { installHistoryShortcuts, useProjectStore } from '../store/projectStore'

function Layout() {
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
        <strong>Cabinet Designer</strong>
        <h1>A little more room to design</h1>
        <p>Open this project in a desktop window at least 1024 pixels wide.</p>
      </div>
      <div className="application-shell">
        <header className="app-header">
          <div className="project-identity">
            <strong>Cabinet Designer</strong>
            <span title={name}>{name}</span>
          </div>
          <nav aria-label="Main navigation" className="segmented navigation">
            <NavLink to="/designer">Designer</NavLink>
            <NavLink to="/cut-list">Cut List</NavLink>
          </nav>
          <div className="header-actions">
            <button
              className="history-button"
              aria-label="Undo"
              title="Undo (Ctrl/Cmd + Z)"
              disabled={!canUndo}
              onClick={undo}
            >
              ↶
            </button>
            <button
              className="history-button"
              aria-label="Redo"
              title="Redo (Ctrl/Cmd + Shift + Z)"
              disabled={!canRedo}
              onClick={redo}
            >
              ↷
            </button>
            <ProjectFiles />
            <button
              className="pill primary"
              aria-expanded={settingsOpen}
              aria-controls="project-settings"
              onClick={() => setSettingsOpen(!settingsOpen)}
            >
              Settings
            </button>
          </div>
        </header>
        {settingsOpen && (
          <section
            className="settings-popover"
            id="project-settings"
            aria-label="Project settings"
          >
            <div className="section-heading">
              <h2>Project settings</h2>
              <button className="pill" onClick={() => setSettingsOpen(false)}>
                Close
              </button>
            </div>
            <ProjectSettings />
            <p className="muted">
              Settings are read-only. Editing will be available soon.
            </p>
          </section>
        )}
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </>
  )
}

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/designer" replace />} />
        <Route path="designer" element={<DesignerPage />} />
        <Route path="cut-list" element={<CutListPage />} />
      </Route>
    </Routes>
  )
}
