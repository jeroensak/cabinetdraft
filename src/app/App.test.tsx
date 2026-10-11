// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { App } from './App'
import { mockResizeObserver } from '../test/mockResizeObserver'
import { useProjectStore } from '../store/projectStore'
import { createDefaultProject } from '../domain/project/createDefaultProject'
import { addModule, renameProject } from '../domain/commands'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
beforeEach(() => {
  mockResizeObserver()
  useProjectStore.setState({
    present: createDefaultProject(),
    past: [],
    future: [],
    previewBase: null,
    editor: {
      selection: null,
      hover: null,
      viewport: { zoom: 1, pan: { x: 0, y: 0 } },
    },
  })
})

describe('application routes', () => {
  it.each([
    ['/designer', 'Designer'],
    ['/cut-list', 'Cut List'],
    ['/', 'Designer'],
  ])('renders %s', (path, heading) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>,
    )
    expect(
      screen.getByRole('heading', { level: 1, name: heading }),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: heading })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('navigates between Designer and Cut List', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/designer']}>
        <App />
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('link', { name: 'Cut List' }))
    expect(screen.getByRole('heading', { name: 'Cut List' })).toBeVisible()
    await user.click(screen.getByRole('link', { name: 'Designer' }))
    expect(screen.getByRole('heading', { name: 'Designer' })).toBeVisible()
  })
})

describe('application shell', () => {
  function renderDesigner() {
    return render(
      <MemoryRouter initialEntries={['/designer']}>
        <App />
      </MemoryRouter>,
    )
  }

  it('selects modules without changing project data or history', async () => {
    const project = addModule(useProjectStore.getState().present)
    useProjectStore.setState({ present: project })
    const user = userEvent.setup()
    renderDesigner()
    expect(screen.getByText('No cabinet selected')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Cabinet 2, 800 mm' }))
    expect(
      screen.getByRole('button', { name: 'Cabinet 2, 800 mm' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Name')).toHaveValue('Cabinet 2')
    expect(screen.getByLabelText('width (mm)')).toHaveValue('800')
    expect(useProjectStore.getState().present).toBe(project)
    expect(useProjectStore.getState().past).toEqual([])
    await user.click(screen.getByRole('link', { name: 'Cut List' }))
    await user.click(screen.getByRole('link', { name: 'Designer' }))
    expect(screen.getByLabelText('Name')).toHaveValue('Cabinet 2')
  })

  it('connects undo and redo controls to project history', async () => {
    const user = userEvent.setup()
    useProjectStore
      .getState()
      .execute((project) => renameProject(project, 'Kitchen'))
    renderDesigner()
    expect(screen.getByText('Kitchen')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByText('Untitled cabinet')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Redo' }))
    expect(screen.getByText('Kitchen')).toBeVisible()
  })

  it('shows global settings separately and enables file controls', async () => {
    const user = userEvent.setup()
    renderDesigner()
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    expect(
      screen.getByRole('region', { name: 'Project settings' }),
    ).toBeVisible()
    expect(screen.getByText('Corpus thickness')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(
      screen.queryByRole('region', { name: 'Project settings' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Import' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Export' })).toBeEnabled()
  })
})
