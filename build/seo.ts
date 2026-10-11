import type { Plugin } from 'vite'
import {
  defaultSiteUrl,
  pageMetadata,
  siteName,
} from '../src/app/pageMetadata.ts'

export function resolveSiteUrl(value = defaultSiteUrl) {
  const url = new URL(value)
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  ) {
    throw new Error(
      'SITE_URL must be an HTTP(S) origin, without a path, credentials, query or fragment.',
    )
  }
  return url.origin
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        character
      ]!,
  )
}

export function renderMetadata(pathname: string, origin: string) {
  const metadata = pageMetadata(pathname)
  const url = `${origin}${pathname}`
  const meta = (key: string, value: string, attribute = 'name') =>
    `<meta ${attribute}="${key}" content="${escapeHtml(value)}" />`
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: siteName,
    url: `${origin}/designer`,
    description: pageMetadata('/designer').description,
    applicationCategory: 'DesignApplication',
    operatingSystem: 'Web browser',
    browserRequirements:
      'JavaScript enabled; desktop viewport of at least 1024 pixels.',
    inLanguage: 'en',
    featureList: [
      'Modular cabinet design',
      'Shelves, doors and drawer fronts',
      'Isometric cabinet preview',
      'Panel cut lists in millimetres',
      'PDF cut list download',
      'Local project saving and JSON import/export',
    ],
  }
  return [
    `<title>${escapeHtml(metadata.title)}</title>`,
    meta('description', metadata.description),
    meta('robots', metadata.robots),
    meta('site-url', origin),
    `<link rel="canonical" href="${escapeHtml(url)}" />`,
    meta('og:type', 'website', 'property'),
    meta('og:site_name', siteName, 'property'),
    meta('og:locale', 'en_US', 'property'),
    meta('og:title', metadata.title, 'property'),
    meta('og:description', metadata.description, 'property'),
    meta('og:url', url, 'property'),
    meta('og:image', `${origin}/social-preview.png`, 'property'),
    meta('og:image:width', '1200', 'property'),
    meta('og:image:height', '630', 'property'),
    meta(
      'og:image:alt',
      'Cabinet Designer: plan DIY cabinets and download panel cut lists.',
      'property',
    ),
    meta('twitter:card', 'summary_large_image'),
    meta('twitter:title', metadata.title),
    meta('twitter:description', metadata.description),
    meta('twitter:image', `${origin}/social-preview.png`),
    meta(
      'twitter:image:alt',
      'Cabinet Designer: plan DIY cabinets and download panel cut lists.',
    ),
    ...(pathname === '/designer'
      ? [
          `<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>`,
        ]
      : []),
  ].join('\n')
}

/** Emit static route metadata so crawlers and link previews do not need JavaScript. */
export function seoPlugin(siteUrl: string): Plugin {
  const origin = resolveSiteUrl(siteUrl)
  return {
    name: 'cabinet-seo',
    enforce: 'post',
    transformIndexHtml(html) {
      return html.replace(
        '<!--app-metadata-->',
        `<!--metadata-start-->${renderMetadata('/designer', origin)}<!--metadata-end-->`,
      )
    },
    generateBundle(_options, bundle) {
      const index = bundle['index.html']
      if (
        !index ||
        index.type !== 'asset' ||
        typeof index.source !== 'string'
      ) {
        throw new Error(
          'Expected Vite to emit index.html before route metadata.',
        )
      }
      this.emitFile({
        type: 'asset',
        fileName: 'cut-list.html',
        source: index.source.replace(
          /<!--metadata-start-->[\s\S]*?<!--metadata-end-->/,
          () => renderMetadata('/cut-list', origin),
        ),
      })
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`,
      })
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${escapeHtml(origin)}/designer</loc></url></urlset>\n`,
      })
    },
  }
}
