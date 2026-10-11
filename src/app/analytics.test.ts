import { afterEach, describe, expect, it, vi } from 'vitest'
import { track } from '@vercel/analytics'
import { sanitizeAnalyticsEvent, trackEvent } from './analytics'

vi.mock('@vercel/analytics', () => ({ track: vi.fn() }))
afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetAllMocks()
})

describe('analytics boundary', () => {
  it('does not emit events unless explicitly enabled by the build', () => {
    vi.stubEnv('VITE_ANALYTICS_ENABLED', 'false')
    trackEvent('project_exported')
    expect(track).not.toHaveBeenCalled()
    vi.stubEnv('VITE_ANALYTICS_ENABLED', 'true')
    trackEvent('project_exported')
    expect(track).toHaveBeenCalledExactlyOnceWith('project_exported')
  })

  it('does not let SDK failures interrupt application actions', () => {
    vi.stubEnv('VITE_ANALYTICS_ENABLED', 'true')
    vi.mocked(track).mockImplementation(() => {
      throw new Error('Unavailable')
    })
    expect(() => trackEvent('project_imported')).not.toThrow()
  })

  it.each(['pageview', 'event'] as const)(
    'removes query strings and fragments from %s URLs',
    (type) => {
      expect(
        sanitizeAnalyticsEvent({
          type,
          url: 'https://example.com/designer?name=Private#secret',
        }),
      ).toEqual({ type, url: 'https://example.com/designer' })
    },
  )

  it.each([
    'https://example.com/private-project-name',
    'https://example.com/',
    'bad URL',
  ])('drops unknown or invalid URLs: %s', (url) => {
    expect(sanitizeAnalyticsEvent({ type: 'pageview', url })).toBeNull()
  })
})
