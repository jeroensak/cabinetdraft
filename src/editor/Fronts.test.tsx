// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DesignerPage } from './DesignerPage'
import { createDefaultProject } from '../domain/project/createDefaultProject'
import { deriveFrontGeometry } from '../domain/fronts/deriveFrontGeometry'
import { useProjectStore } from '../store/projectStore'
import { mockResizeObserver } from '../test/mockResizeObserver'
import {
  addDrawerDesign,
  addShelfToSpace,
  applyDrawerDesign,
  removeFront,
} from '../domain/commands'
import { defaultDrawerDesign } from '../domain/drawers/types'
import { spaceRange } from '../domain/spaces/spaceRanges'
import { DOOR_MOUNT_STORAGE_KEY } from '../store/doorMountPreference'
import { addBoxlessFront } from '../domain/commands/testHelpers'
import { deriveSpaces } from '../domain/spaces/deriveSpaces'

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
function clearFronts() {
  const project = useProjectStore.getState().present
  useProjectStore.setState({
    present: removeFront(
      project,
      project.modules[0].id,
      project.modules[0].fronts[0].id,
    ),
  })
}

describe('Fronts mode', () => {
  it('exposes covered spaces only in Structure mode', async () => {
    const user = userEvent.setup()
    render(<DesignerPage />)
    expect(
      screen.getAllByRole('button', { name: /Cabinet 1 space/ }),
    ).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: 'Fronts' }))
    expect(screen.queryByRole('button', { name: /Cabinet 1 space/ })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Structure' }))
    expect(
      screen.getAllByRole('button', { name: /Cabinet 1 space/ }),
    ).toHaveLength(2)
  })
  it('switches presentation without project/history changes, selects one semantic double door, and edits its leaves', async () => {
    const user = userEvent.setup()
    const project = useProjectStore.getState().present
    const { container } = render(<DesignerPage />)
    await user.click(screen.getByRole('button', { name: 'Fronts' }))
    expect(useProjectStore.getState().present).toBe(project)
    expect(useProjectStore.getState().past).toHaveLength(0)
    expect(container.querySelectorAll('[data-source="door"]')).toHaveLength(6)
    const sources = [...container.querySelectorAll('[data-source]')].map(
      (element) => element.getAttribute('data-source'),
    )
    expect(sources.slice(-6)).toEqual(Array(6).fill('door'))
    expect(screen.queryByRole('button', { name: /shelf at/ })).toBeNull()
    await user.click(
      screen.getByRole('button', { name: 'Cabinet 1 double door 1' }),
    )
    expect(screen.getByText('397 × 2196 mm')).toBeInTheDocument()
    expect(screen.getByText('Cabinet bottom')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Door leaves'), '1')
    expect(container.querySelectorAll('[data-source="door"]')).toHaveLength(3)
    expect(screen.getByText('796 × 2196 mm')).toBeInTheDocument()
    expect(useProjectStore.getState().past).toHaveLength(1)
  })
  it('creates a spanning door from adjacent Shift-selected spaces', async () => {
    clearFronts()
    const user = userEvent.setup()
    render(<DesignerPage />)
    await user.click(screen.getByRole('button', { name: 'Fronts' }))
    await user.click(screen.getByRole('button', { name: 'Cabinet 1 space 1' }))
    await user.keyboard('{Shift>}')
    await user.click(screen.getByRole('button', { name: 'Cabinet 1 space 2' }))
    await user.keyboard('{/Shift}')
    expect(screen.getByText('2 selected spaces')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add drawer' })).toBeEnabled()
    expect(
      screen.queryByRole('button', { name: 'Add drawer front' }),
    ).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Add door' }))
    const front = useProjectStore.getState().present.modules[0].fronts[0]
    expect(front.bottomBoundary.type).toBe('module-bottom')
    expect(front.topBoundary.type).toBe('module-top')
    expect(
      screen.getByRole('button', { name: 'Cabinet 1 single door 1' }),
    ).toBeInTheDocument()
  })
  it('replaces the add buttons with remove on a space holding a door', async () => {
    clearFronts()
    const user = userEvent.setup()
    render(<DesignerPage />)
    await user.click(screen.getByRole('button', { name: 'Fronts' }))
    await user.click(screen.getByRole('button', { name: 'Cabinet 1 space 1' }))
    await user.click(screen.getByRole('button', { name: 'Add door' }))
    expect(screen.queryByRole('button', { name: 'Add door' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Add drawer' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Remove door' }))
    expect(useProjectStore.getState().present.modules[0].fronts).toEqual([])
    expect(screen.getByRole('button', { name: 'Add door' })).toBeEnabled()
  })
  it('applies the last door position to every new door', async () => {
    clearFronts()
    useProjectStore.getState().setLastDoorMount('overlay')
    const user = userEvent.setup()
    render(<DesignerPage />)
    await user.click(screen.getByRole('button', { name: 'Fronts' }))
    await user.click(screen.getByRole('button', { name: 'Cabinet 1 space 1' }))
    await user.click(screen.getByRole('button', { name: 'Add door' }))
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Position' }),
      'inset',
    )
    await user.click(screen.getByRole('button', { name: 'Cabinet 1 space 2' }))
    await user.click(screen.getByRole('button', { name: 'Add door' }))
    const doors = useProjectStore.getState().present.modules[0].fronts
    expect(doors).toHaveLength(2)
    expect(doors.map((door) => door.type === 'door' && door.mount)).toEqual([
      'inset',
      'inset',
    ])
    expect(localStorage.getItem(DOOR_MOUNT_STORAGE_KEY)).toBe('inset')
    useProjectStore.getState().setLastDoorMount('overlay')
  })
  it('switches the design of a drawer from its space', async () => {
    clearFronts()
    useProjectStore.getState().execute((project) => {
      const shallow = { ...defaultDrawerDesign(), depth: 300, name: 'Shallow' }
      const designed = addDrawerDesign(
        addDrawerDesign(project, { ...shallow, name: 'Deep', depth: 400 }),
        shallow,
      )
      const module = designed.modules[0]
      return applyDrawerDesign(designed, designed.drawerDesigns[0].id, [
        {
          moduleId: module.id,
          range: spaceRange(deriveSpaces(module, designed.settings)[0]),
        },
      ])
    })
    const user = userEvent.setup()
    render(<DesignerPage />)
    await user.click(screen.getByRole('button', { name: 'Structure' }))
    await user.click(screen.getByRole('button', { name: 'Cabinet 1 space 1' }))
    expect(screen.getByRole('button', { name: 'Remove drawer' })).toBeEnabled()
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Drawer box design' }),
      'Shallow',
    )
    const { drawerDesigns, modules } = useProjectStore.getState().present
    const front = modules[0].fronts[0]
    expect(front.type === 'drawer' && front.drawerDesignId).toBe(
      drawerDesigns[1].id,
    )
  })
  it('switches a door between overlay and inset and explains the setback', async () => {
    const user = userEvent.setup()
    render(<DesignerPage />)
    await user.click(screen.getByRole('button', { name: 'Fronts' }))
    await user.click(
      screen.getByRole('button', { name: /Cabinet 1 double door/ }),
    )
    const position = screen.getByRole('combobox', { name: 'Position' })
    expect(position).toHaveValue('overlay')
    await user.selectOptions(position, 'inset')
    const door = useProjectStore.getState().present.modules[0].fronts[0]
    expect(door).toMatchObject({ mount: 'inset' })
    expect(
      screen.getByText(/behind this door sit 20 mm back/),
    ).toBeInTheDocument()
    expect(useProjectStore.getState().past).toHaveLength(1)
    act(() => useProjectStore.getState().undo())
    expect(
      useProjectStore.getState().present.modules[0].fronts[0],
    ).not.toHaveProperty('mount')
  })

  it('does not permit a disjoint multi-space selection', async () => {
    clearFronts()
    const project = useProjectStore.getState().present
    useProjectStore.setState({
      present: addShelfToSpace(
        project,
        project.modules[0].id,
        deriveSpaces(project.modules[0], project.settings)[0],
      ),
    })
    const user = userEvent.setup()
    render(<DesignerPage />)
    await user.click(screen.getByRole('button', { name: 'Cabinet 1 space 1' }))
    await user.keyboard('{Shift>}')
    await user.click(screen.getByRole('button', { name: 'Cabinet 1 space 3' }))
    await user.keyboard('{/Shift}')
    expect(
      screen.getByRole('button', { name: 'Cabinet 1 space 1' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByRole('button', { name: 'Cabinet 1 space 3' }),
    ).toHaveAttribute('aria-pressed', 'false')
  })
  it('keeps a spanning door unchanged when adding a shelf behind it', async () => {
    const user = userEvent.setup()
    const before = useProjectStore.getState().present
    const original = deriveFrontGeometry(
      before.modules[0],
      before.settings,
      before.modules[0].fronts[0],
    )
    const { container } = render(<DesignerPage />)
    await user.click(screen.getByRole('button', { name: 'Cabinet 1 space 1' }))
    await user.click(screen.getByRole('button', { name: 'Add shelf' }))
    await user.click(screen.getByRole('button', { name: 'Fronts' }))
    const after = useProjectStore.getState().present
    expect(
      deriveFrontGeometry(
        after.modules[0],
        after.settings,
        after.modules[0].fronts[0],
      ),
    ).toEqual(original)
    expect(container.querySelectorAll('[data-source="door"]')).toHaveLength(6)
  })
  it('splits a drawer front atomically when adding a shelf and restores it with undo', async () => {
    clearFronts()
    const project = useProjectStore.getState().present
    const module = project.modules[0]
    useProjectStore.setState({
      present: addBoxlessFront(
        project,
        module.id,
        deriveSpaces(module, project.settings)[0],
      ),
    })
    const user = userEvent.setup()
    render(<DesignerPage />)
    await user.click(screen.getByRole('button', { name: 'Cabinet 1 space 1' }))
    const originalId =
      useProjectStore.getState().present.modules[0].fronts[0].id
    await user.click(screen.getByRole('button', { name: 'Add shelf' }))
    expect(useProjectStore.getState().past).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Fronts' }))
    expect(
      screen.getAllByRole('button', { name: /Cabinet 1 drawer front/ }),
    ).toHaveLength(2)
    act(() => useProjectStore.getState().undo())
    expect(
      screen.getAllByRole('button', { name: /Cabinet 1 drawer front/ }),
    ).toHaveLength(1)
    expect(useProjectStore.getState().present.modules[0].fronts[0].id).toBe(
      originalId,
    )
  })
})
