// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import {
  act,
  cleanup,
  render,
  screen,
  within,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { CutListPage } from './CutListPage'
import { createDefaultProject } from '../domain/project/createDefaultProject'
import {
  duplicateModule,
  setModuleDimensions,
  reorderModules,
} from '../domain/commands'
import { useProjectStore } from '../store/projectStore'
import { App } from '../app/App'
import { mockResizeObserver } from '../test/mockResizeObserver'
import { trackEvent } from '../app/analytics'
import { downloadCutListPdf } from './cutListPdf'

vi.mock('../app/analytics', () => ({ trackEvent: vi.fn() }))
vi.mock('./cutListPdf', () => ({ downloadCutListPdf: vi.fn() }))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
beforeEach(() => {
  vi.resetAllMocks()
  useProjectStore.setState({
    present: createDefaultProject(),
    past: [],
    future: [],
    previewBase: null,
  })
})
function renderCutList() {
  return render(
    <MemoryRouter>
      <CutListPage />
    </MemoryRouter>,
  )
}

describe('Cut List page', () => {
  it('tracks PDF outcomes only after generation and supports retry after failure', async () => {
    const user = userEvent.setup()
    renderCutList()
    let finish!: () => void
    vi.mocked(downloadCutListPdf).mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finish = resolve
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Download PDF' }))
    expect(trackEvent).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Creating PDF…' })).toBeDisabled()
    await act(async () => finish())
    expect(trackEvent).toHaveBeenCalledExactlyOnceWith(
      'cut_list_pdf_downloaded',
    )
    vi.mocked(downloadCutListPdf).mockRejectedValueOnce(
      new Error('Private error text'),
    )
    await user.click(screen.getByRole('button', { name: 'Download PDF' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not create the PDF',
    )
    expect(trackEvent).toHaveBeenLastCalledWith('cut_list_pdf_failed')
    vi.mocked(downloadCutListPdf).mockResolvedValueOnce(undefined)
    await user.click(screen.getByRole('button', { name: 'Download PDF' }))
    await waitFor(() => expect(trackEvent).toHaveBeenCalledTimes(3))
    expect(trackEvent).toHaveBeenLastCalledWith('cut_list_pdf_downloaded')
  })
  it('merges identical parts by default, with a quantity and every ID', () => {
    renderCutList()
    const doors = screen.getByRole('row', { name: /C1-DOOR-1-L, C1-DOOR-1-R/ })
    expect(
      within(doors)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['Cabinet 1', 'Door', '2', '2196', '397', '18'])
    expect(screen.getByText(/Identical parts share a row/)).toBeInTheDocument()
  })
  it('renders each physical panel with units and per-leaf rows, without mounting SVG', async () => {
    const user = userEvent.setup()
    const { container } = renderCutList()
    await user.click(
      screen.getByRole('checkbox', { name: 'Group identical parts' }),
    )
    expect(screen.getByText('✓ Configuration valid')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download PDF' })).toBeEnabled()
    expect(screen.getAllByRole('row')).toHaveLength(11)
    const door = screen.getByRole('row', { name: /C1-DOOR-1-L/ })
    expect(
      within(door)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['Cabinet 1', 'Door', '1', '2196', '397', '18'])
    expect(
      screen.getAllByRole('columnheader', { name: 'Thickness (mm)' }),
    ).toHaveLength(3)
    expect(container.querySelector('svg')).toBeNull()
  })
  it('splits the cut list into parts lists, leaving out empty ones', () => {
    renderCutList()
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent),
    ).toEqual(['Cabinet bases 5', 'Shelves and dividers 1', 'Doors 2'])
    const bases = screen.getByRole('region', { name: /Cabinet bases/ })
    expect(within(bases).getByRole('row', { name: /C1-BACK/ })).toBeVisible()
    expect(within(bases).queryByRole('row', { name: /C1-DOOR/ })).toBeNull()
  })
  it('keeps identical modules separate and reflects edits and array order', async () => {
    const user = userEvent.setup()
    const original = useProjectStore.getState().present
    const project = duplicateModule(original, original.modules[0].id)
    useProjectStore.setState({ present: project })
    renderCutList()
    await user.click(
      screen.getByRole('checkbox', { name: 'Group identical parts' }),
    )
    expect(screen.getAllByRole('row')).toHaveLength(19)
    act(() =>
      useProjectStore
        .getState()
        .execute((project) =>
          setModuleDimensions(project, project.modules[1].id, { width: 900 }),
        ),
    )
    expect(screen.getByRole('row', { name: /C2-DOOR-1-L/ })).toHaveTextContent(
      '447',
    )
    act(() =>
      useProjectStore
        .getState()
        .execute((project) =>
          reorderModules(
            project,
            project.modules.map((module) => module.id).reverse(),
          ),
        ),
    )
    expect(screen.getByRole('row', { name: /C1-DOOR-1-L/ })).toHaveTextContent(
      'Cabinet 1 copy',
    )
    expect(screen.getByRole('row', { name: /C1-DOOR-1-L/ })).toHaveTextContent(
      '447',
    )
  })
  it('withholds the entire table for one invalid module and restores it after undo', () => {
    const original = useProjectStore.getState().present
    useProjectStore.setState({
      present: duplicateModule(original, original.modules[0].id),
    })
    renderCutList()
    act(() =>
      useProjectStore
        .getState()
        .execute((project) =>
          setModuleDimensions(project, project.modules[1].id, { width: 801 }),
        ),
    )
    expect(
      screen.getByRole('heading', { name: 'Cut list unavailable' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Resolve configuration errors in the Designer first.'),
    ).toBeInTheDocument()
    expect(screen.queryAllByRole('table')).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Download PDF' })).toBeDisabled()
    expect(screen.queryByText('C1-SIDE-L')).toBeNull()
    act(() => useProjectStore.getState().undo())
    expect(screen.getAllByRole('table')).toHaveLength(3)
  })
  it('handles an empty project and provides a working return route', async () => {
    mockResizeObserver()
    useProjectStore.setState({
      present: { ...createDefaultProject(), modules: [] },
    })
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/cut-list']}>
        <App />
      </MemoryRouter>,
    )
    expect(screen.getByText('No panels yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download PDF' })).toBeDisabled()
    await user.click(screen.getByRole('link', { name: '← Back to Designer' }))
    expect(
      screen.getByRole('heading', { name: 'Designer' }),
    ).toBeInTheDocument()
  })
})
