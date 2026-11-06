// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router'
import { CutListPage } from '../cut-list/CutListPage'
import { setLanguage } from '../i18n'
import { LanguagePicker } from './LanguagePicker'

afterEach(() => {
  cleanup()
  setLanguage('en')
  localStorage.clear()
})

it('switches the whole page without a reload and lists languages in their own name', async () => {
  const user = userEvent.setup()
  render(
    <MemoryRouter>
      <LanguagePicker />
      <CutListPage />
    </MemoryRouter>,
  )
  await user.click(screen.getByRole('button', { name: 'Language' }))
  expect(
    screen.getAllByRole('menuitemradio').map((item) => item.textContent),
  ).toEqual(['English', 'Nederlands', 'Deutsch', 'Français'])
  expect(screen.getByRole('menuitemradio', { name: 'English' })).toBeChecked()
  await user.click(screen.getByRole('menuitemradio', { name: 'Deutsch' }))
  expect(screen.queryByRole('menu')).toBeNull()
  expect(
    screen.getByRole('heading', { name: 'Zuschnittliste' }),
  ).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Sprache' }))
  expect(screen.getByRole('menuitemradio', { name: 'Deutsch' })).toBeChecked()
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('menu')).toBeNull()
  expect(screen.getByRole('button', { name: 'Sprache' })).toHaveFocus()
  expect(
    screen.getByRole('heading', { name: /Schrankkorpusse/ }),
  ).toBeInTheDocument()
})
