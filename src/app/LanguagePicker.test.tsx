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
  expect(
    screen.getAllByRole('option').map((option) => option.textContent),
  ).toEqual(['English', 'Nederlands', 'Deutsch', 'Français'])
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Language' }),
    'de',
  )
  expect(
    screen.getByRole('heading', { name: 'Zuschnittliste' }),
  ).toBeInTheDocument()
  expect(screen.getByRole('combobox', { name: 'Sprache' })).toHaveValue('de')
  expect(
    screen.getByRole('heading', { name: /Schrankkorpusse/ }),
  ).toBeInTheDocument()
})
