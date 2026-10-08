import { NavLink, Navigate, Outlet, Route, Routes } from 'react-router'
import { DesignerPage } from '../editor/DesignerPage'
import { CutListPage } from '../cut-list/CutListPage'

function Layout() {
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <header className="flex items-center justify-between border-b border-stone-200 bg-white px-8 py-5">
        <span className="font-semibold">Cabinet Designer</span>
        <nav aria-label="Main navigation" className="flex gap-6">
          <NavLink to="/designer">Designer</NavLink>
          <NavLink to="/cut-list">Cut List</NavLink>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-8 py-16">
        <Outlet />
      </main>
    </div>
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
