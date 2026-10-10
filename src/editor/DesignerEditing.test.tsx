// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DesignerPage } from './DesignerPage'
import { createDefaultProject } from '../domain/project/createDefaultProject'
import { useProjectStore } from '../store/projectStore'
import { mockResizeObserver } from '../test/mockResizeObserver'

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

describe('Structure editing', () => {
  it('commits a dimension draft once, accepts invalid geometry, and preserves text deletion', async () => {
    const user = userEvent.setup()
    render(<DesignerPage />)
    await user.click(screen.getByRole('button', { name: 'Cabinet 1, 800 mm' }))
    const width = screen.getByLabelText('width (mm)')
    await user.clear(width)
    await user.type(width, '900')
    expect(useProjectStore.getState().present.modules[0].width).toBe(800)
    expect(useProjectStore.getState().past).toHaveLength(0)
    await user.keyboard('{Enter}')
    expect(useProjectStore.getState().present.modules[0].width).toBe(900)
    expect(useProjectStore.getState().past).toHaveLength(1)
    await user.click(screen.getByLabelText('width (mm)'))
    await user.keyboard('{Backspace}')
    expect(useProjectStore.getState().present.modules).toHaveLength(1)
    await user.clear(screen.getByLabelText('width (mm)'))
    await user.type(screen.getByLabelText('width (mm)'), '10{Enter}')
    expect(useProjectStore.getState().present.modules[0].width).toBe(10)
    expect(screen.getAllByText('! Invalid geometry')).toHaveLength(2)
  })

  it('rejects fractional input without a history entry', async () => {
    const user = userEvent.setup()
    render(<DesignerPage />)
    await user.click(screen.getByRole('button', { name: 'Cabinet 1, 800 mm' }))
    await user.clear(screen.getByLabelText('height (mm)'))
    await user.type(screen.getByLabelText('height (mm)'), '2000.5{Enter}')
    expect(screen.getByRole('alert')).toHaveTextContent('whole number')
    expect(useProjectStore.getState().past).toHaveLength(0)
  })

  it('adds a shelf in a selected space and clears its destroyed selection', async () => {
    const user = userEvent.setup()
    render(<DesignerPage />)
    await user.click(screen.getByRole('button', { name: 'Cabinet 1 space 1' }))
    const front = useProjectStore.getState().present.modules[0].fronts[0]
    await user.click(screen.getByRole('button', { name: 'Add shelf' }))
    expect(useProjectStore.getState().present.modules[0].shelves).toHaveLength(
      2,
    )
    expect(useProjectStore.getState().present.modules[0].fronts[0]).toEqual(
      front,
    )
    expect(useProjectStore.getState().editor.selection).toBeNull()
    expect(useProjectStore.getState().past).toHaveLength(1)
  })

  it('previews shelf dragging live, commits once, and cancels an interrupted drag', () => {
    vi.stubGlobal('PointerEvent', MouseEvent)
    render(<DesignerPage />)
    const shelf = screen.getByRole('button', {
      name: 'Cabinet 1 shelf at 1091 mm',
    })
    Object.defineProperty(shelf, 'setPointerCapture', { value: vi.fn() })
    Object.defineProperty(shelf, 'releasePointerCapture', { value: vi.fn() })
    const zoom = useProjectStore.getState().editor.viewport.zoom
    fireEvent.pointerDown(shelf, { button: 0, clientY: 300 })
    fireEvent.pointerMove(shelf, { clientY: 300 - zoom * 100 })
    expect(
      useProjectStore.getState().present.modules[0].shelves[0].bottom,
    ).toBe(1191)
    expect(useProjectStore.getState().past).toHaveLength(0)
    fireEvent.pointerMove(shelf, { clientY: 300 - zoom * 200 })
    fireEvent.pointerUp(shelf)
    expect(useProjectStore.getState().past).toHaveLength(1)
    expect(
      useProjectStore.getState().present.modules[0].shelves[0].bottom,
    ).toBe(1291)
    fireEvent.pointerDown(shelf, { button: 0, clientY: 300 })
    fireEvent.pointerMove(shelf, { clientY: 250 })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(
      useProjectStore.getState().present.modules[0].shelves[0].bottom,
    ).toBe(1291)
    expect(useProjectStore.getState().previewBase).toBeNull()
    act(() => useProjectStore.getState().undo())
    expect(
      useProjectStore.getState().present.modules[0].shelves[0].bottom,
    ).toBe(1091)
  })

  it('deletes a selected shelf via keyboard and clears the selection across undo', async () => {
    const user = userEvent.setup()
    render(<DesignerPage />)
    await user.click(
      screen.getByRole('button', { name: 'Cabinet 1 shelf at 1091 mm' }),
    )
    await user.keyboard('{Delete}')
    expect(useProjectStore.getState().present.modules[0].shelves).toHaveLength(
      0,
    )
    expect(useProjectStore.getState().editor.selection).toBeNull()
    act(() => useProjectStore.getState().undo())
    expect(useProjectStore.getState().present.modules[0].shelves).toHaveLength(
      1,
    )
    expect(useProjectStore.getState().editor.selection).toBeNull()
  })
})
