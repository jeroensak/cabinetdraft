// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { DraftField } from './DraftField'

afterEach(cleanup)

it('restores the committed value after a rejected command without retrying on blur', async () => {
  const user = userEvent.setup()
  const commit = vi.fn(() => false)
  render(<DraftField label="Bottom" value={100} numeric onCommit={commit} />)
  const input = screen.getByLabelText('Bottom (mm)')
  await user.clear(input)
  await user.type(input, '200{Enter}')
  expect(input).toHaveValue('100')
  expect(commit).toHaveBeenCalledExactlyOnceWith('200')
  await user.click(input)
  await user.tab()
  expect(commit).toHaveBeenCalledTimes(1)
})

it('does not commit Enter while an IME composition is in progress', async () => {
  const user = userEvent.setup()
  const commit = vi.fn()
  render(<DraftField label="Name" value="Cabinet" onCommit={commit} />)
  const input = screen.getByLabelText('Name')
  await user.click(input)
  fireEvent.change(input, { target: { value: 'New name' } })
  fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
  expect(input).toHaveFocus()
  expect(commit).not.toHaveBeenCalled()
  await user.keyboard('{Enter}')
  expect(commit).toHaveBeenCalledExactlyOnceWith('New name')
})
