// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { App } from './App'

afterEach(cleanup)

describe('application routes', () => {
  it.each([
    ['/designer', 'Designer'],
    ['/cut-list', 'Cut List'],
    ['/', 'Designer'],
  ])('renders %s', (path, heading) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>,
    )
    expect(
      screen.getByRole('heading', { level: 1, name: heading }),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: heading })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('navigates between Designer and Cut List', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/designer']}>
        <App />
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('link', { name: 'Cut List' }))
    expect(screen.getByRole('heading', { name: 'Cut List' })).toBeVisible()
    await user.click(screen.getByRole('link', { name: 'Designer' }))
    expect(screen.getByRole('heading', { name: 'Designer' })).toBeVisible()
  })
})
