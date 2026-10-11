// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { Link, MemoryRouter } from 'react-router'
import { AppAnalytics } from './AppAnalytics'

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  delete window.va
  delete window.vam
  document
    .querySelectorAll('script[src*="vercel"]')
    .forEach((script) => script.remove())
})

it('does not load the SDK script when analytics are disabled', () => {
  vi.stubEnv('VITE_ANALYTICS_ENABLED', 'false')
  render(
    <MemoryRouter>
      <AppAnalytics />
    </MemoryRouter>,
  )
  expect(document.querySelector('script[src*="vercel"]')).toBeNull()
  expect(window.va).toBeUndefined()
})

it('sends one page view per route change, ignoring query/hash changes and unknown paths', async () => {
  vi.stubEnv('VITE_ANALYTICS_ENABLED', 'true')
  const send = vi.fn()
  window.va = send
  const user = userEvent.setup()
  const { getByRole } = render(
    <MemoryRouter initialEntries={['/designer?name=Private#secret']}>
      <Link to="/designer?name=Another#other">Same route</Link>
      <Link to="/cut-list">Cut List</Link>
      <Link to="/private-name">Unknown route</Link>
      <AppAnalytics />
    </MemoryRouter>,
  )
  const pageviews = () =>
    send.mock.calls.filter(([type]) => type === 'pageview')
  expect(pageviews()).toEqual([
    ['pageview', { route: '/designer', path: '/designer' }],
  ])
  expect(
    document.querySelector('script[data-disable-auto-track="1"]'),
  ).not.toBeNull()
  await user.click(getByRole('link', { name: 'Same route' }))
  expect(pageviews()).toHaveLength(1)
  await user.click(getByRole('link', { name: 'Cut List' }))
  expect(pageviews()).toHaveLength(2)
  expect(pageviews()[1]).toEqual([
    'pageview',
    { route: '/cut-list', path: '/cut-list' },
  ])
  await user.click(getByRole('link', { name: 'Unknown route' }))
  expect(pageviews()).toHaveLength(2)
})
