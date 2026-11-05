// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createDefaultProject } from '../../domain/project/createDefaultProject'
import { useProjectStore } from '../../store/projectStore'
import { DESIGN_LIBRARY_KEY } from '../../store/designLibrary'
import { DesignPicker } from './DesignPicker'

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

it('turns switching off when saved designs are unreadable', () => {
  useProjectStore.setState({ designs: null })
  render(<DesignPicker />)
  expect(
    screen.getByRole('combobox', { name: 'Current design' }),
  ).toBeDisabled()
  expect(screen.getByRole('button', { name: '+ New design' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Delete design' })).toBeDisabled()
})
