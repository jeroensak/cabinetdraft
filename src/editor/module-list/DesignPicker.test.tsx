// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createDefaultProject } from '../../domain/project/createDefaultProject'
import { useProjectStore } from '../../store/projectStore'
import { DESIGN_LIBRARY_KEY } from '../../store/designLibrary'
import { ProjectSettings } from '../properties/ProjectSettings'
import { DesignPicker } from './DesignPicker'
import { NewDesignDialog } from './NewDesignDialog'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
beforeEach(() => {
  localStorage.clear()
  useProjectStore.setState({
    present: { ...createDefaultProject(), name: 'Kitchen' },
    past: [],
    future: [],
    previewBase: null,
    designs: [],
    persistence: {
      loadError: null,
      saveError: null,
      recoveryData: null,
      unsaved: false,
    },
  })
})

it('names, creates from a template and switches designs', async () => {
  const user = userEvent.setup()
  render(<DesignPicker />)
  const select = screen.getByRole('combobox', { name: 'Current design' })
  expect(select).toHaveDisplayValue('Kitchen')

  const name = screen.getByLabelText('Design name')
  await user.clear(name)
  await user.type(name, 'Pantry{Enter}')
  expect(select).toHaveDisplayValue('Pantry')

  await user.clear(screen.getByLabelText('Design name'))
  await user.keyboard('{Enter}')
  expect(useProjectStore.getState().present.name).toBe('Pantry')
  expect(screen.getByLabelText('Design name')).toHaveValue('Pantry')

  await user.click(screen.getByRole('button', { name: '+ New design' }))
  const dialog = screen.getByRole('dialog', { name: 'New design' })
  expect(within(dialog).getAllByRole('radio')).toHaveLength(3)
  await user.click(within(dialog).getAllByRole('radio')[1]!)
  await user.type(within(dialog).getByLabelText('Name'), 'Hall')
  await user.click(
    within(dialog).getByRole('button', { name: 'Create design' }),
  )
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(useProjectStore.getState().present.name).toBe('Hall')
  expect(
    screen.getAllByRole('option').map((option) => option.textContent),
  ).toEqual(['Pantry', 'Hall'])

  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Current design' }),
    'Pantry',
  )
  expect(useProjectStore.getState().present.name).toBe('Pantry')
})

it('closes the new design dialog on Escape and Cancel without creating', async () => {
  const user = userEvent.setup()
  render(<DesignPicker />)
  await user.click(screen.getByRole('button', { name: '+ New design' }))
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).toBeNull()
  await user.click(screen.getByRole('button', { name: '+ New design' }))
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(localStorage.getItem(DESIGN_LIBRARY_KEY)).toBeNull()
})

it('deletes the open design only after confirmation, never the last one', async () => {
  const user = userEvent.setup()
  render(<DesignPicker />)
  const remove = screen.getByRole('button', { name: 'Delete design' })
  expect(remove).toBeDisabled()

  await user.click(screen.getByRole('button', { name: '+ New design' }))
  await user.type(screen.getByLabelText('Name'), 'Hall')
  await user.click(screen.getByRole('button', { name: 'Create design' }))
  expect(remove).toBeEnabled()

  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  await user.click(remove)
  expect(confirm).toHaveBeenCalledWith('Delete "Hall"? This can’t be undone.')
  expect(useProjectStore.getState().present.name).toBe('Hall')

  confirm.mockReturnValue(true)
  await user.click(remove)
  expect(useProjectStore.getState().present.name).toBe('Kitchen')
  expect(screen.getAllByRole('option')).toHaveLength(1)
  expect(remove).toBeDisabled()
})

it('sets inches when creating a design, entered and shown as fractions', async () => {
  const user = userEvent.setup()
  render(
    <>
      <DesignPicker />
      <ProjectSettings />
    </>,
  )
  await user.click(screen.getByRole('button', { name: '+ New design' }))
  const dialog = screen.getByRole('dialog', { name: 'New design' })
  await user.selectOptions(
    within(dialog).getByRole('combobox', { name: 'Units' }),
    'inch',
  )
  await user.click(
    within(dialog).getByRole('button', { name: 'Create design' }),
  )
  expect(screen.getByText('Inches')).toBeInTheDocument()
  const thickness = screen.getByRole('textbox', {
    name: 'Corpus thickness (in)',
  })
  expect(thickness).toHaveValue('3/4')

  await user.clear(thickness)
  await user.type(thickness, '1/64{Enter}')
  expect(screen.getByRole('alert')).toHaveTextContent('nearest 1/32')
  expect(useProjectStore.getState().present.settings.corpusThickness).toBe(24)

  await user.clear(thickness)
  await user.type(thickness, '5/8{Enter}')
  expect(useProjectStore.getState().present.settings.corpusThickness).toBe(20)
  expect(
    screen.getByRole('textbox', { name: 'Corpus thickness (in)' }),
  ).toHaveValue('5/8')
})

it('duplicates the open design from the menu', async () => {
  const user = userEvent.setup()
  render(<DesignPicker />)
  await user.click(screen.getByRole('button', { name: 'Duplicate design' }))
  expect(useProjectStore.getState().present.name).toBe('Kitchen copy')
  expect(
    screen.getAllByRole('option').map((option) => option.textContent),
  ).toEqual(['Kitchen', 'Kitchen copy'])
})

it('cannot be dismissed on a first visit unless saving fails', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  useProjectStore.setState({ needsFirstDesign: true })
  render(<NewDesignDialog required onClose={onClose} />)
  expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull()
  await user.keyboard('{Escape}')
  expect(onClose).not.toHaveBeenCalled()

  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('quota')
  })
  await user.click(screen.getByRole('button', { name: 'Create design' }))
  expect(screen.getByRole('alert')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(onClose).toHaveBeenCalledOnce()
})

it('turns switching off when saved designs are unreadable', () => {
  useProjectStore.setState({ designs: null })
  render(<DesignPicker />)
  expect(
    screen.getByRole('combobox', { name: 'Current design' }),
  ).toBeDisabled()
  expect(screen.getByRole('button', { name: '+ New design' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Delete design' })).toBeDisabled()
})
