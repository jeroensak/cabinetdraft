import { expect, test } from '@playwright/test'

test('production HTML provides metadata and discovery files before JavaScript', async ({
  request,
}) => {
  const designer = await request.get('/designer')
  expect(designer.ok()).toBe(true)
  const html = await designer.text()
  expect(html).toContain(
    '<title>Cabinet Designer — Online Cabinet Planner &amp; Cut Lists</title>',
  )
  expect(html).toContain(
    'name="robots" content="index, follow, max-image-preview:large"',
  )
  expect(html).toContain('type="application/ld+json"')
  const canonical = html.match(/rel="canonical" href="([^"]+)"/)![1]
  const origin = new URL(canonical).origin
  expect(canonical).toBe(`${origin}/designer`)

  // This is the document targeted by Vercel's /cut-list rewrite.
  const cutList = await request.get('/cut-list.html')
  expect(cutList.ok()).toBe(true)
  expect(await cutList.text()).toContain(
    'name="robots" content="noindex, follow"',
  )
  const sitemap = await request.get('/sitemap.xml')
  expect(sitemap.ok()).toBe(true)
  expect(await sitemap.text()).toContain(`<loc>${canonical}</loc>`)
  expect(await sitemap.text()).not.toContain('/cut-list')
  const robots = await request.get('/robots.txt')
  expect(await robots.text()).toContain(`Sitemap: ${origin}/sitemap.xml`)
  const image = await request.get('/social-preview.png')
  expect(image.headers()['content-type']).toContain('image/png')
  expect((await image.body()).readUInt32BE(16)).toBe(1200)
  expect((await image.body()).readUInt32BE(20)).toBe(630)
})

test('navigation updates titles, indexing rules and canonical URLs without duplicates', async ({
  page,
}) => {
  await page.goto('/cut-list')
  await expect(page).toHaveTitle(
    'Cabinet Cut List & PDF Export | Cabinet Designer',
  )
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    'noindex, follow',
  )
  await page.getByRole('link', { name: 'Designer', exact: true }).click()
  await expect(page).toHaveTitle(
    'Cabinet Designer — Online Cabinet Planner & Cut Lists',
  )
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    'index, follow, max-image-preview:large',
  )
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(1)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    /\/designer$/,
  )
  await expect(page.locator('meta[name="description"]')).toHaveCount(1)
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Designer', exact: true }),
  ).toBeVisible()
})
