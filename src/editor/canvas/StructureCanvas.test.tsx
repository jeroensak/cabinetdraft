// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StructureCanvas } from './StructureCanvas'
import { ModuleList } from '../module-list/ModuleList'
import { useProjectStore } from '../../store/projectStore'
import { createDefaultProject } from '../../domain/project/createDefaultProject'
import { addModule, setModuleDimensions } from '../../domain/commands'
import { exportProject } from '../../domain/import-export/projectJson'
import { mockResizeObserver } from '../../test/mockResizeObserver'

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

describe('Structure canvas', () => {
  it('retains the viewport across route remounts and fits modules added while away', () => {
    const first = render(<StructureCanvas />)
    const custom = { zoom: 1, pan: { x: 25, y: 40 } }
    act(() => useProjectStore.getState().setViewport(custom))
    first.unmount()
    const second = render(<StructureCanvas />)
    expect(useProjectStore.getState().editor.viewport).toEqual(custom)
    second.unmount()
    act(() => useProjectStore.getState().execute(addModule))
    render(<StructureCanvas />)
    expect(useProjectStore.getState().editor.viewport.zoom).toBeLessThan(
      custom.zoom,
    )
    expect(useProjectStore.getState().past).toHaveLength(1)
  })
  it('refits an imported project even when its IDs match the current design', () => {
    render(<StructureCanvas />)
    act(() =>
      useProjectStore
        .getState()
        .setViewport({ zoom: 4, pan: { x: -900, y: -900 } }),
    )
    const raw = exportProject(useProjectStore.getState().present)
    act(() => useProjectStore.getState().replaceProject(raw))
    expect(useProjectStore.getState().editor.viewport.zoom).toBeLessThan(1)
    expect(useProjectStore.getState().past).toHaveLength(1)
  })

  it('renders canonical structure and overall dimensions, with contextual dimensions on selection', async () => {
    const user = userEvent.setup()
    const { container } = render(<StructureCanvas />)
    expect(container.querySelectorAll('[data-source="shelf"]')).toHaveLength(3)
    expect(container.querySelector('[data-source="door"]')).toBeNull()
    expect(screen.getByText('800 mm total')).toBeInTheDocument()
    expect(screen.getByText('max 2200 mm')).toBeInTheDocument()
    expect(screen.queryByText('600 mm depth')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Select Cabinet 1' }))
    expect(screen.getByText('800 mm width')).toBeInTheDocument()
    expect(screen.getByText('2200 mm height')).toBeInTheDocument()
    expect(screen.getByText('600 mm depth')).toBeInTheDocument()
  })
  it('links hover in both directions without changing selection or project history', () => {
    render(
      <>
        <ModuleList />
        <StructureCanvas />
      </>,
    )
    const row = screen.getByRole('button', { name: 'Cabinet 1, 800 mm' })
    const cabinet = screen.getByRole('button', { name: 'Select Cabinet 1' })
    fireEvent.pointerEnter(row)
    expect(cabinet).toHaveAttribute('data-hovered', 'true')
    fireEvent.pointerLeave(row)
    expect(cabinet).toHaveAttribute('data-hovered', 'false')
    fireEvent.pointerEnter(cabinet)
    expect(row).toHaveAttribute('data-hovered', 'true')
    fireEvent.pointerLeave(cabinet)
    expect(row).toHaveAttribute('data-hovered', 'false')
    expect(useProjectStore.getState().editor.selection).toBeNull()
    expect(useProjectStore.getState().past).toEqual([])
  })
  it('zooms with wheel/buttons and restores fit without persisting viewport changes', async () => {
    const user = userEvent.setup()
    const project = useProjectStore.getState().present
    render(<StructureCanvas />)
    const fitted = useProjectStore.getState().editor.viewport
    fireEvent.wheel(screen.getByLabelText('Cabinet structure'), {
      deltaY: -100,
      clientX: 200,
      clientY: 150,
    })
    expect(useProjectStore.getState().editor.viewport.zoom).toBeGreaterThan(
      fitted.zoom,
    )
    await user.click(screen.getByRole('button', { name: 'Zoom in' }))
    await user.click(screen.getByRole('button', { name: 'Fit to view' }))
    expect(useProjectStore.getState().editor.viewport).toEqual(fitted)
    expect(useProjectStore.getState().present).toBe(project)
    expect(useProjectStore.getState().past).toEqual([])
  })
  it('keeps invalid dimensions intact and labels invalid geometry', () => {
    const project = createDefaultProject()
    project.modules[0].width = 10
    useProjectStore.setState({ present: project })
    render(<StructureCanvas />)
    expect(screen.getByText('! Invalid geometry')).toBeInTheDocument()
    expect(screen.getByText('10 mm total')).toBeInTheDocument()
    expect(useProjectStore.getState().present.modules[0].width).toBe(10)
  })
  it('pans only from empty canvas and ends the gesture on release', () => {
    vi.stubGlobal('PointerEvent', MouseEvent)
    render(<StructureCanvas />)
    const canvas = screen.getByLabelText('Cabinet structure')
    Object.defineProperty(canvas, 'setPointerCapture', { value: vi.fn() })
    Object.defineProperty(canvas, 'releasePointerCapture', { value: vi.fn() })
    const initial = useProjectStore.getState().editor.viewport
    fireEvent.pointerDown(
      screen.getByRole('button', { name: 'Select Cabinet 1' }),
      { button: 0, clientX: 100, clientY: 100 },
    )
    fireEvent.pointerMove(canvas, { clientX: 130, clientY: 140 })
    expect(useProjectStore.getState().editor.viewport).toEqual(initial)
    fireEvent.pointerDown(canvas, { button: 0, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(canvas, { clientX: 130, clientY: 140 })
    expect(useProjectStore.getState().editor.viewport.pan).toEqual({
      x: initial.pan.x + 30,
      y: initial.pan.y + 40,
    })
    fireEvent.pointerUp(canvas)
    fireEvent.pointerMove(canvas, { clientX: 300, clientY: 300 })
    expect(useProjectStore.getState().editor.viewport.pan).toEqual({
      x: initial.pan.x + 30,
      y: initial.pan.y + 40,
    })
    expect(useProjectStore.getState().past).toEqual([])
  })

  it('does not refit ordinary edits, but fits an added module outside the viewport', () => {
    render(<StructureCanvas />)
    act(() =>
      useProjectStore.getState().setViewport({ zoom: 1, pan: { x: 5, y: 10 } }),
    )
    const moduleId = useProjectStore.getState().present.modules[0].id
    act(() =>
      useProjectStore
        .getState()
        .execute((project) =>
          setModuleDimensions(project, moduleId, { height: 2400 }),
        ),
    )
    expect(useProjectStore.getState().editor.viewport).toEqual({
      zoom: 1,
      pan: { x: 5, y: 10 },
    })
    act(() => useProjectStore.getState().execute(addModule))
    expect(useProjectStore.getState().editor.viewport.zoom).toBeLessThan(1)
    expect(
      screen.getByRole('button', { name: 'Select Cabinet 2' }),
    ).toBeInTheDocument()
    expect(screen.getByText('1600 mm total')).toBeInTheDocument()
    expect(screen.getByText('max 2400 mm')).toBeInTheDocument()
  })
})
