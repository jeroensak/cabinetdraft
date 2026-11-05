// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DesignerPage } from '../editor/DesignerPage'
import { createDefaultProject } from '../domain/project/createDefaultProject'
import { removeFront } from '../domain/commands'
import { useProjectStore } from '../store/projectStore'
import { mockResizeObserver } from '../test/mockResizeObserver'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
beforeEach(() => {
  mockResizeObserver()
  const project = createDefaultProject()
  useProjectStore.setState({
    present: removeFront(
      project,
      project.modules[0].id,
      project.modules[0].fronts[0].id,
    ),
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

describe('Drawer designer', () => {
  it('opens from selected spaces, creates a reusable design and applies it to each space in one undoable step', async () => {
    const user = userEvent.setup()
    render(<DesignerPage />)
    await user.click(screen.getByRole('button', { name: 'Cabinet 1 space 1' }))
    await user.keyboard('{Shift>}')
    await user.click(screen.getByRole('button', { name: 'Cabinet 1 space 2' }))
    await user.keyboard('{/Shift}')
    await user.click(screen.getByRole('button', { name: 'Add drawer…' }))

    expect(
      screen.getByRole('heading', { name: 'Drawer designs' }),
    ).toBeInTheDocument()
    expect(screen.getByText('No drawer design')).toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: '+ New drawer design' }),
    )
    expect(useProjectStore.getState().present.drawerDesigns).toHaveLength(1)
    expect(
      screen.getByRole('img', {
        name: 'Drawer preview: 754 × 537 × 450 mm box',
      }),
    ).toBeInTheDocument()

    const historyBefore = useProjectStore.getState().past.length
    await user.click(
      screen.getByRole('button', { name: 'Apply to 2 selected spaces' }),
    )
    const state = useProjectStore.getState()
    expect(state.past).toHaveLength(historyBefore + 1)
    expect(state.editor.drawerDesigner).toBeNull()
    const designId = state.present.drawerDesigns[0].id
    expect(
      state.present.modules[0].fronts.map((front) =>
        front.type === 'drawer' ? front.drawerDesignId : front.type,
      ),
    ).toStrictEqual([designId, designId])
    expect(
      screen.getByRole('button', { name: 'Add drawer…' }),
    ).toBeInTheDocument()

    act(() => useProjectStore.getState().undo())
    expect(useProjectStore.getState().present.modules[0].fronts).toHaveLength(0)
  })

  it('edits shared design measurements, rejecting side gaps below 3 mm', async () => {
    const user = userEvent.setup()
    render(<DesignerPage />)
    await user.click(screen.getByRole('button', { name: 'Cabinet 1 space 1' }))
    await user.click(screen.getByRole('button', { name: 'Add drawer…' }))
    await user.click(
      screen.getByRole('button', { name: '+ New drawer design' }),
    )
    const sideGap = screen.getByRole('textbox', {
      name: 'Side gap (each side) (mm)',
    })
    await user.clear(sideGap)
    await user.type(sideGap, '2{Enter}')
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Side clearance must be a whole number of at least 3 mm.',
    )
    expect(
      useProjectStore.getState().present.drawerDesigns[0].sideClearance,
    ).toBe(5)

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Side height' }),
      'fixed',
    )
    const height = screen.getByRole('textbox', { name: 'Fixed height (mm)' })
    await user.clear(height)
    await user.type(height, '200{Enter}')
    expect(useProjectStore.getState().present.drawerDesigns[0].height).toBe(200)
    expect(
      screen.getByRole('img', {
        name: 'Drawer preview: 754 × 200 × 450 mm box',
      }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '← Back to cabinet' }))
    expect(useProjectStore.getState().editor.drawerDesigner).toBeNull()
  })

  it('lists designs in the left menu and opens them without target spaces', async () => {
    const user = userEvent.setup()
    render(<DesignerPage />)
    const menu = screen.getByRole('complementary', {
      name: 'Cabinets and drawers',
    })
    expect(
      within(menu).getByRole('heading', { name: 'Drawers' }),
    ).toBeInTheDocument()
    expect(within(menu).getByText(/No drawer designs yet/)).toBeInTheDocument()

    await user.click(
      within(menu).getByRole('button', { name: '+ New drawer design' }),
    )
    const design = useProjectStore.getState().present.drawerDesigns[0]
    expect(useProjectStore.getState().editor.drawerDesigner).toEqual({
      moduleId: null,
      ranges: [],
      designId: design.id,
    })
    expect(screen.getByText(/Add this design to a space/)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /^Apply to/ }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '← Back to cabinet' }))
    await user.click(screen.getByRole('button', { name: 'Cabinet 1 space 1' }))
    await user.click(screen.getByRole('button', { name: 'Add drawer…' }))
    await user.click(
      screen.getByRole('button', { name: 'Apply to 1 selected space' }),
    )

    await user.click(screen.getByRole('button', { name: /Used by 1 drawer/ }))
    expect(screen.getByText('Previewed in Cabinet 1')).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: /^Drawer preview:/ }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /^Apply to/ }),
    ).not.toBeInTheDocument()
  })
})
