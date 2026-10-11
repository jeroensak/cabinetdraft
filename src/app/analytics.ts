import { track, type BeforeSendEvent } from '@vercel/analytics'

export type AnalyticsEvent =
  | 'project_changed'
  | 'project_imported'
  | 'project_import_failed'
  | 'project_exported'
  | 'cut_list_pdf_downloaded'
  | 'cut_list_pdf_failed'

export function analyticsEnabled() {
  return import.meta.env.VITE_ANALYTICS_ENABLED === 'true'
}

/** Fixed event names only: no project data or free-form error messages. */
export function trackEvent(event: AnalyticsEvent) {
  if (!analyticsEnabled()) return
  try {
    track(event)
  } catch {
    // Analytics must never interrupt editing, saving or downloads.
  }
}

export function sanitizeAnalyticsEvent(
  event: BeforeSendEvent,
): BeforeSendEvent | null {
  try {
    const url = new URL(event.url)
    if (!['/designer', '/cut-list'].includes(url.pathname)) return null
    url.search = ''
    url.hash = ''
    return { ...event, url: url.href }
  } catch {
    return null
  }
}
