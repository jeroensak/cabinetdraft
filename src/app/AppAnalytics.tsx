import { Analytics } from '@vercel/analytics/react'
import { useEffect } from 'react'
import { useLocation } from 'react-router'
import {
  analyticsEnabled,
  sanitizeAnalyticsEvent,
  trackEvent,
} from './analytics'
import { observeProjectChanges } from './observeProjectChanges'
import { useProjectStore } from '../store/projectStore'

export function AppAnalytics() {
  const { pathname } = useLocation()
  const enabled = analyticsEnabled()
  useEffect(() => {
    if (!enabled) return
    return observeProjectChanges(useProjectStore, () =>
      trackEvent('project_changed'),
    )
  }, [enabled])

  if (!enabled) return null
  // Explicit routes disable the SDK's automatic history tracking, preventing duplicates.
  const route = ['/designer', '/cut-list'].includes(pathname) ? pathname : null
  return (
    <Analytics
      route={route}
      path={route}
      beforeSend={sanitizeAnalyticsEvent}
      mode={import.meta.env.DEV ? 'development' : 'production'}
    />
  )
}
