// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, within } from '@testing-library/react'
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
    needsFirstDesign: false,
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
    expect(screen.getByTitle('Kitchen')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByTitle('Untitled cabinet')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Redo' }))
    expect(screen.getByTitle('Kitchen')).toBeVisible()
  })

  it('commits project settings as single undoable edits and updates the cut list', async () => {
    const user = userEvent.setup()
    renderDesigner()
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    act(() =>
      useProjectStore
        .getState()
        .execute((project) => renameProject(project, 'Kitchen')),
    )
    expect(useProjectStore.getState().present.name).toBe('Kitchen')
    expect(useProjectStore.getState().past).toHaveLength(1)
    await user.clear(screen.getByLabelText('Front gap (mm)'))
    await user.type(screen.getByLabelText('Front gap (mm)'), '3{Enter}')
    expect(useProjectStore.getState().past).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await user.click(screen.getByRole('link', { name: 'Cut List' }))
    expect(screen.getByText('Cut list unavailable')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getAllByRole('table')[0]!).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    expect(screen.getByLabelText('Front gap (mm)')).toHaveValue('2')
    await user.click(screen.getByLabelText('Back panel enabled'))
    expect(useProjectStore.getState().present.settings.backPanelEnabled).toBe(
      false,
    )
    expect(screen.queryByText('C1-BACK')).toBeNull()
  })

  it('asks for the band thickness only while banding is on', async () => {
    const user = userEvent.setup()
    renderDesigner()
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    const label = 'Edge banding thickness (mm)'
    expect(screen.queryByLabelText(label)).toBeNull()
    await user.click(screen.getByLabelText('Edge banding enabled'))
    const input = screen.getByLabelText(label)
    expect(input).toHaveValue('0')
    await user.clear(input)
    await user.type(input, '0.3{Enter}')
    expect(screen.getByRole('alert')).toHaveTextContent('steps of 0.5')
    await user.clear(input)
    await user.type(input, '0.5{Enter}')
    expect(
      useProjectStore.getState().present.settings.edgeBandingThickness,
    ).toBe(0.5)
    expect(screen.getByLabelText(label)).toHaveValue('0.5')
  })

  it('turns edge banding on from Settings, as one undoable step', async () => {
    const user = userEvent.setup()
    renderDesigner()
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await user.click(screen.getByLabelText('Edge banding enabled'))
    expect(useProjectStore.getState().present.settings.edgeBanding).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(useProjectStore.getState().present.settings).not.toHaveProperty(
      'edgeBanding',
    )
  })

  it('shows global settings separately and enables file controls', async () => {
    const user = userEvent.setup()
    renderDesigner()
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    expect(
      screen.getByRole('region', { name: 'Design settings' }),
    ).toBeVisible()
    expect(screen.getByText('Corpus thickness')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(
      screen.queryByRole('region', { name: 'Design settings' }),
    ).not.toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Import, export and share' }),
    )
    expect(screen.getByRole('menuitem', { name: 'Import' })).toBeEnabled()
    expect(screen.getByRole('menuitem', { name: 'Export' })).toBeEnabled()
  })

  it('closes settings on Escape and outside clicks, and keeps the view mode', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/designer']}>
        <App />
      </MemoryRouter>,
    )
    const settings = screen.getByRole('button', { name: 'Settings' })
    await user.click(settings)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('region', { name: 'Design settings' })).toBeNull()
    await user.click(settings)
    await user.click(screen.getByRole('heading', { name: 'Cabinets' }))
    expect(screen.queryByRole('region', { name: 'Design settings' })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Fronts' }))
    await user.click(screen.getByRole('link', { name: 'Cut List' }))
    await user.click(screen.getByRole('link', { name: 'Designer' }))
    expect(screen.getByRole('button', { name: 'Fronts' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('explains an invalid design and offers undo after deleting a cabinet', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/designer']}>
        <App />
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('button', { name: /^Cabinet 1, / }))
    const width = screen.getByLabelText('width (mm)')
    await user.clear(width)
    await user.type(width, '801{Enter}')
    expect(screen.getByText(/doesn’t come out at an exact size/)).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    const notice = screen.getByText('Cabinet 1 deleted').parentElement!
    await user.click(within(notice).getByRole('button', { name: 'Undo' }))
    expect(useProjectStore.getState().present.modules).toHaveLength(1)
    expect(screen.queryByText('Cabinet 1 deleted')).toBeNull()
  })
})
