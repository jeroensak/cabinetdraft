import { describe, expect, it } from 'vitest'
import { renderMetadata, resolveSiteUrl } from './seo.ts'

describe('production SEO metadata', () => {
  it('uses a stable production origin, including on preview builds', () => {
    expect(resolveSiteUrl()).toBe('https://cabinetdraft.vercel.app')
    expect(resolveSiteUrl('https://cabinets.example/')).toBe(
      'https://cabinets.example',
    )
    const html = renderMetadata('/designer', 'https://cabinets.example')
    expect(html).toContain(
      'rel="canonical" href="https://cabinets.example/designer"',
    )
    expect(html).toContain('https://cabinets.example/social-preview.png')
    const schema = JSON.parse(
      html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)![1],
    )
    expect(schema.url).toBe('https://cabinets.example/designer')
    expect(schema['@type']).toBe('WebApplication')
  })

  it.each([
    'not a URL',
    'javascript:alert(1)',
    'https://example.com/designer',
    'https://user:password@example.com',
    'https://example.com?preview=1',
    'https://example.com#designer',
  ])('rejects an invalid public origin: %s', (value) => {
    expect(() => resolveSiteUrl(value)).toThrow()
  })

  it('indexes the designer but excludes the local project cut list and unknown routes', () => {
    expect(renderMetadata('/designer', resolveSiteUrl())).toContain(
      'content="index, follow, max-image-preview:large"',
    )
    expect(renderMetadata('/cut-list', resolveSiteUrl())).toContain(
      'content="noindex, follow"',
    )
    expect(renderMetadata('/missing', resolveSiteUrl())).toContain(
      'content="noindex, follow"',
    )
  })
})
