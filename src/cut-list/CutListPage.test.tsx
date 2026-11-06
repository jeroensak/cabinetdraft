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
import drawersAndDoor from '../design-templates/template-2.json'
import waveSideboard from '../test-fixtures/wave-sideboard.json'
import type { Project } from '../domain/project/types'
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

describe('sheet layout view', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  const openSheets = async () => {
    const user = userEvent.setup()
    renderCutList()
    await user.click(screen.getByRole('button', { name: 'Sheets' }))
    return user
  }

  it('draws the canonical parts on sheets of the standard default size', async () => {
    await openSheets()
    expect(screen.getByRole('combobox', { name: 'Sheet size' })).toHaveValue(
      '2440x1220',
    )
    expect(screen.getByRole('textbox', { name: 'Saw kerf (mm)' })).toHaveValue(
      '4',
    )
    expect(screen.getAllByRole('status').at(-1)).toHaveTextContent(
      '4 sheets12 cuts',
    )
    const drawings = screen.getAllByRole('img')
    expect(drawings).toHaveLength(4)
    expect(drawings.at(-1)).toHaveAccessibleName(/3 mm.*C1-BACK/)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('replans for another sheet and kerf, and remembers them', async () => {
    const user = await openSheets()
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Sheet size' }),
      '2800x2070',
    )
    expect(screen.getAllByRole('status').at(-1)).toHaveTextContent('3 sheets')
    const kerf = screen.getByRole('textbox', { name: 'Saw kerf (mm)' })
    await user.clear(kerf)
    await user.type(kerf, '3{Enter}')
    expect(
      JSON.parse(localStorage.getItem('cabinet-designer:sheet-stock')!),
    ).toStrictEqual({
      mm: { length: 2800, width: 2070, kerf: 3, priority: 'cuts' },
    })
    cleanup()
    await openSheets()
    expect(screen.getByRole('combobox', { name: 'Sheet size' })).toHaveValue(
      '2800x2070',
    )
  })

  it('saves sheets instead of cuts on request, and remembers it', async () => {
    useProjectStore.setState({ present: drawersAndDoor as unknown as Project })
    const user = await openSheets()
    const total = () => screen.getAllByRole('status').at(-1)
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Sheet size' }),
      '2500x1250',
    )
    const priority = screen.getByRole('combobox', { name: 'Optimise for' })
    expect(priority).toHaveValue('cuts')
    expect(total()).toHaveTextContent('5 sheets31 cuts')
    await user.selectOptions(priority, 'sheets')
    expect(total()).toHaveTextContent('4 sheets38 cuts')
    cleanup()
    await openSheets()
    expect(screen.getByRole('combobox', { name: 'Optimise for' })).toHaveValue(
      'sheets',
    )
  })

  it('takes a custom size and names parts that do not fit', async () => {
    const user = await openSheets()
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Sheet size' }),
      'custom',
    )
    const length = screen.getByRole('textbox', { name: 'Sheet length (mm)' })
    await user.clear(length)
    await user.type(length, '2000{Enter}')
    expect(screen.getByRole('alert')).toHaveTextContent(/C1-SIDE-L.*C1-BACK/)
  })

  it('refuses a sheet without a size', async () => {
    const user = await openSheets()
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Sheet size' }),
      'custom',
    )
    const width = screen.getByRole('textbox', { name: 'Sheet width (mm)' })
    await user.clear(width)
    await user.type(width, '0{Enter}')
    expect(width).toHaveValue('1220')
    const length = screen.getByRole('textbox', { name: 'Sheet length (mm)' })
    await user.clear(length)
    await user.type(length, '0{Enter}')
    expect(length).toHaveValue('2440')
  })

  it('restores a custom size after a reload', async () => {
    localStorage.setItem(
      'cabinet-designer:sheet-stock',
      JSON.stringify({
        mm: { length: 2600, width: 1300, kerf: 5, priority: 'cuts' },
      }),
    )
    await openSheets()
    expect(screen.getByRole('combobox', { name: 'Sheet size' })).toHaveValue(
      'custom',
    )
    expect(
      screen.getByRole('textbox', { name: 'Sheet length (mm)' }),
    ).toHaveValue('2600')
  })

  it('goes back to a standard size from a custom one', async () => {
    const user = await openSheets()
    const size = screen.getByRole('combobox', { name: 'Sheet size' })
    await user.selectOptions(size, 'custom')
    await user.selectOptions(size, '3050x1525')
    expect(
      screen.queryByRole('textbox', { name: 'Sheet length (mm)' }),
    ).not.toBeInTheDocument()
    expect(
      JSON.parse(localStorage.getItem('cabinet-designer:sheet-stock')!).mm,
    ).toMatchObject({ length: 3050, width: 1525 })
  })

  it('accepts no kerf, and refuses a negative or fractional one', async () => {
    const user = await openSheets()
    const kerf = screen.getByRole('textbox', { name: 'Saw kerf (mm)' })
    await user.clear(kerf)
    await user.type(kerf, '-1{Enter}')
    expect(screen.getByRole('textbox', { name: 'Saw kerf (mm)' })).toHaveValue(
      '4',
    )
    const again = screen.getByRole('textbox', { name: 'Saw kerf (mm)' })
    await user.clear(again)
    await user.type(again, '3.2{Enter}')
    expect(again).toBeInvalid()
    await user.clear(again)
    await user.type(again, '0{Enter}')
    expect(
      JSON.parse(localStorage.getItem('cabinet-designer:sheet-stock')!).mm.kerf,
    ).toBe(0)
  })

  it('replans when the design changes', async () => {
    await openSheets()
    const size = () => screen.getAllByRole('status').at(-1)?.textContent
    const before = size()
    act(() => {
      const present = useProjectStore.getState().present
      useProjectStore.setState({
        present: duplicateModule(present, present.modules[0]!.id),
      })
    })
    expect(size()).not.toBe(before)
  })

  it('keeps each unit to its own sheets when the design changes unit', async () => {
    await openSheets()
    const present = createDefaultProject()
    present.settings.unit = 'inch'
    act(() => useProjectStore.setState({ present }))
    expect(screen.getByRole('combobox', { name: 'Sheet size' })).toHaveValue(
      `${96 * 32}x${48 * 32}`,
    )
    expect(screen.getByRole('textbox', { name: 'Saw kerf (in)' })).toHaveValue(
      '1/8',
    )
  })

  it('shows the empty message when the last cabinet is gone', async () => {
    await openSheets()
    const present = createDefaultProject()
    present.modules = []
    act(() => useProjectStore.setState({ present }))
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'No panels yet' }),
    ).toBeInTheDocument()
  })

  it('withholds the sheets while the design is invalid', async () => {
    await openSheets()
    const base = createDefaultProject()
    const present = setModuleDimensions(base, base.modules[0]!.id, {
      width: 801,
    })
    act(() => useProjectStore.setState({ present }))
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Cut list unavailable' }),
    ).toBeInTheDocument()
  })

  it('labels every part, and keeps every cut on the sheet', async () => {
    useProjectStore.setState({ present: waveSideboard as unknown as Project })
    await openSheets()
    const svg = screen.getAllByRole('img')
    for (const drawing of svg) {
      const [, , length, width] = drawing
        .getAttribute('viewBox')!
        .split(' ')
        .map(Number)
      expect(drawing.querySelectorAll('.sheet-part')).toHaveLength(
        drawing.querySelectorAll('.sheet-part-label').length,
      )
      for (const line of drawing.querySelectorAll('.sheet-cut line')) {
        expect(Number(line.getAttribute('x2'))).toBeLessThanOrEqual(length!)
        expect(Number(line.getAttribute('y2'))).toBeLessThanOrEqual(width!)
      }
    }
  })

  it('offers inch sheets in an inch design', async () => {
    const present = createDefaultProject()
    present.settings.unit = 'inch'
    useProjectStore.setState({ present })
    await openSheets()
    expect(screen.getByRole('option', { name: `8' × 4'` })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: `4' × 2'` })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Saw kerf (in)' })).toHaveValue(
      '1/8',
    )
  })
})

describe('edge banding', () => {
  const useProject = (project: Project) =>
    useProjectStore.setState({ present: project })
  const row = (id: string) => screen.getByRole('row', { name: new RegExp(id) })

  it('shows nothing while the project has it off', () => {
    renderCutList()
    expect(screen.queryByText(/Edge banding/)).not.toBeInTheDocument()
  })

  it('shows the banded edges per row and the total', () => {
    const project = createDefaultProject()
    useProject({
      ...project,
      settings: { ...project.settings, edgeBanding: true },
    })
    renderCutList()
    expect(
      screen.getAllByRole('columnheader', { name: 'Edge banding' }),
    ).not.toHaveLength(0)
    expect(within(row('C1-SIDE-L')).getByText('Front edge')).toBeInTheDocument()
    expect(within(row('C1-BACK')).getByText('None')).toBeInTheDocument()
    expect(
      within(row('C1-DOOR-1-L')).getByText('All 4 edges'),
    ).toBeInTheDocument()
    expect(screen.getByText(/^Edge banding needed: [\d,]+ mm$/)).toBeVisible()
    expect(screen.queryByText(/wave-top/)).not.toBeInTheDocument()
  })

  it('keeps the same total when rows are merged or not', async () => {
    const user = userEvent.setup()
    const original = createDefaultProject()
    const project = duplicateModule(original, original.modules[0]!.id)
    useProject({
      ...project,
      settings: { ...project.settings, edgeBanding: true },
    })
    renderCutList()
    const total = screen.getByText(/^Edge banding needed/).textContent
    await user.click(screen.getByRole('checkbox'))
    expect(screen.getByText(/^Edge banding needed/).textContent).toBe(total)
  })

  it('explains the wave allowance when a design has wave fronts', () => {
    const project = waveSideboard as unknown as Project
    useProject({
      ...project,
      settings: { ...project.settings, edgeBanding: true },
    })
    renderCutList()
    expect(screen.getAllByText('All 4 edges +25%')).not.toHaveLength(0)
    expect(screen.getByText(/25% extra on wave-top/)).toBeVisible()
  })
})
