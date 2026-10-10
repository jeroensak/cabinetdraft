// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DesignerPage } from '../DesignerPage'
import { createDefaultProject } from '../../domain/project/createDefaultProject'
import { useProjectStore } from '../../store/projectStore'
import { mockResizeObserver } from '../../test/mockResizeObserver'
import { deriveArrangement } from '../../domain/cabinet/deriveArrangement'

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

describe('module management', () => {
  it('adds an empty cabinet, selects it, and supports rename, delete and undo', async () => {
    const user = userEvent.setup()
    render(<DesignerPage />)
    await user.click(screen.getByRole('button', { name: '+ Add cabinet' }))
    const module = useProjectStore.getState().present.modules[1]
    expect(module).toMatchObject({
      width: 800,
      height: 2200,
      depth: 600,
      shelves: [],
      fronts: [],
    })
    expect(useProjectStore.getState().editor.selection).toEqual({
      type: 'module',
      moduleId: module.id,
    })
    await user.clear(screen.getByLabelText('Name'))
    await user.type(screen.getByLabelText('Name'), 'Pantry{Enter}')
    expect(
      screen.getByRole('button', { name: 'Pantry, 800 mm' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(useProjectStore.getState().present.modules).toHaveLength(1)
    act(() => useProjectStore.getState().undo())
    expect(
      screen.getByRole('button', { name: 'Pantry, 800 mm' }),
    ).toBeInTheDocument()
    expect(screen.getByText('1600 mm total')).toBeInTheDocument()
  })
  it('duplicates complete internals with independent IDs and selects the copy', async () => {
    const user = userEvent.setup()
    const original = useProjectStore.getState().present.modules[0]
    render(<DesignerPage />)
    await user.click(screen.getByRole('button', { name: 'Cabinet 1, 800 mm' }))
    await user.click(screen.getByRole('button', { name: 'Duplicate' }))
    const copy = useProjectStore.getState().present.modules[1]
    expect(copy.shelves).toHaveLength(original.shelves.length)
    expect(copy.fronts).toHaveLength(original.fronts.length)
    expect(copy.id).not.toBe(original.id)
    expect(copy.shelves[0].id).not.toBe(original.shelves[0].id)
    expect(copy.fronts[0].id).not.toBe(original.fronts[0].id)
    expect(useProjectStore.getState().editor.selection?.moduleId).toBe(copy.id)
  })
  it('reorders on drop, not drag-over, updates derived origins, and undoes once', async () => {
    const user = userEvent.setup()
    render(<DesignerPage />)
    await user.click(screen.getByRole('button', { name: '+ Add cabinet' }))
    const before = useProjectStore.getState().present
    const first = screen.getByRole('button', { name: 'Cabinet 1, 800 mm' })
    const second = screen.getByRole('button', { name: 'Cabinet 2, 800 mm' })
    const dataTransfer = { setData: vi.fn(), effectAllowed: '', dropEffect: '' }
    fireEvent.dragStart(second, { dataTransfer })
    fireEvent.dragOver(first, { dataTransfer, clientY: 0 })
    expect(useProjectStore.getState().present).toBe(before)
    fireEvent.drop(first, { dataTransfer, clientY: 0 })
    const after = useProjectStore.getState().present
    expect(after.modules.map((module) => module.id)).toEqual(
      [...before.modules.map((module) => module.id)].reverse(),
    )
    expect(
      deriveArrangement(after).modules.map((item) => [
        item.module.name,
        item.origin.x,
      ]),
    ).toEqual([
      ['Cabinet 2', 0],
      ['Cabinet 1', 800],
    ])
    expect(useProjectStore.getState().past).toHaveLength(2)
    act(() => useProjectStore.getState().undo())
    expect(useProjectStore.getState().present).toEqual(before)
  })
})
