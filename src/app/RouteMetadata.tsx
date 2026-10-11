import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { defaultSiteUrl, pageMetadata } from './pageMetadata'

/** Keep the build-time metadata accurate after client-side navigation. */
export function RouteMetadata() {
  const { pathname } = useLocation()
  useEffect(() => {
    const metadata = pageMetadata(pathname)
    document.title = metadata.title
    const setMeta = (
      attribute: 'name' | 'property',
      key: string,
      value: string,
    ) => {
      let element = document.head.querySelector<HTMLMetaElement>(
        `meta[${attribute}="${key}"]`,
      )
      if (!element) {
        element = document.createElement('meta')
        element.setAttribute(attribute, key)
        document.head.append(element)
      }
      element.content = value
    }
    setMeta('name', 'description', metadata.description)
    setMeta('name', 'robots', metadata.robots)
    setMeta('property', 'og:title', metadata.title)
    setMeta('property', 'og:description', metadata.description)
    setMeta('name', 'twitter:title', metadata.title)
    setMeta('name', 'twitter:description', metadata.description)
    const origin =
      document.querySelector<HTMLMetaElement>('meta[name="site-url"]')
        ?.content ?? defaultSiteUrl
    const url = new URL(pathname === '/' ? '/designer' : pathname, origin).href
    setMeta('property', 'og:url', url)
    let canonical = document.head.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    )
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.append(canonical)
    }
    canonical.href = url
  }, [pathname])
  return null
}
