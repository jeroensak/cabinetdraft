import { readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import { seedSavedProject } from './seed.js'

test('a first visit asks for a design and saves only the chosen one', async ({
  page,
}) => {
  await page.goto('/designer')
  const dialog = page.getByRole('dialog', { name: 'New design' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toHaveCount(0)
  await expect(page.getByRole('main')).toBeEmpty()

  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem('cabinet-designer:project:v1')),
    )
    .toBeNull()

  await dialog.getByLabel('Name', { exact: true }).fill('Hallway')
  await dialog.getByRole('button', { name: 'Create design' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByLabel('Design name')).toHaveValue('Hallway')
  await expect(
    page.getByRole('combobox', { name: 'Current design' }).locator('option'),
  ).toHaveText(['Hallway'])

  await page.reload()
  await expect(page.getByLabel('Design name')).toHaveValue('Hallway')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('a first visit can change language or import a file before choosing', async ({
  page,
}) => {
  await page.goto('/designer')
  await page.getByRole('button', { name: 'Import, export and share' }).click()
  await expect(page.getByRole('menuitem', { name: 'Import' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Export' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Language' }).click()
  await page.getByRole('menuitemradio', { name: 'Deutsch' }).click()
  await expect(
    page.getByRole('dialog', { name: 'Neuer Entwurf' }),
  ).toBeVisible()

  await page.getByLabel('Projektdatei importieren').setInputFiles({
    name: 'project.json',
    mimeType: 'application/json',
    buffer: readFileSync('e2e/saved-project.json'),
  })
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByLabel('Name des Entwurfs')).toHaveValue(
    'Untitled cabinet',
  )
  await expect(
    page.getByRole('combobox', { name: 'Aktueller Entwurf' }).locator('option'),
  ).toHaveCount(1)
})

test('a share link opens as a new design for someone else, after asking', async ({
  browser,
}) => {
  const sender = await browser.newContext()
  await sender.grantPermissions(['clipboard-read', 'clipboard-write'])
  const from = await sender.newPage()
  await from.goto('/designer')
  await from.getByLabel('Name', { exact: true }).fill('Shared hallway')
  await from.getByRole('radio').nth(1).check()
  await from.getByRole('button', { name: 'Create design' }).click()
  await from.getByRole('button', { name: 'Import, export and share' }).click()
  await from.getByRole('menuitem', { name: 'Share' }).click()
  await expect(
    from.getByRole('status').filter({ hasText: 'Link copied' }),
  ).toBeVisible()
  const link = String(await from.evaluate('navigator.clipboard.readText()'))
  expect(link).toMatch(/\/designer#design=/)

  const receiver = await browser.newContext()
  const to = await receiver.newPage()
  let message = ''
  to.once('dialog', (dialog) => {
    message = dialog.message()
    void dialog.accept()
  })
  await to.goto(link)
  await expect(to.getByLabel('Design name')).toHaveValue('Shared hallway')
  expect(message).toContain('Shared hallway')
  await expect(to).toHaveURL(/\/designer$/)
  await expect(
    to.getByRole('button', { name: 'Wide cabinet, 1998 mm', exact: true }),
  ).toBeVisible()
  await to.reload()
  await expect(to.getByLabel('Design name')).toHaveValue('Shared hallway')

  await sender.close()
  await receiver.close()
})

test('a broken share link explains itself and changes nothing', async ({
  page,
}) => {
  await page.goto('/designer#design=broken')
  await expect(page.getByRole('alert')).toContainText('share link')
  await expect(page.getByRole('dialog', { name: 'New design' })).toBeVisible()
})

test('shortcuts leave the design alone while a dialog is open', async ({
  page,
}) => {
  await seedSavedProject(page)
  await page.goto('/designer')
  await page.getByRole('button', { name: 'Cabinet 1, 800 mm' }).click()
  await page.getByRole('button', { name: '+ New design' }).click()
  await page.getByRole('button', { name: 'Create design' }).focus()
  await page.keyboard.press('Delete')
  await page.keyboard.press('ControlOrMeta+z')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Cabinet 1, 800 mm' }),
  ).toBeVisible()
})

test('a second tab follows the first instead of overwriting it', async ({
  context,
}) => {
  const first = await context.newPage()
  await seedSavedProject(first)
  await first.goto('/designer')
  const second = await context.newPage()
  await seedSavedProject(second)
  await second.goto('/designer')

  await first.getByLabel('Design name').fill('From first tab')
  await first.getByLabel('Design name').press('Enter')
  await expect(second.getByLabel('Design name')).toHaveValue('From first tab')
  await expect(second.getByRole('status').first()).toContainText('another tab')

  await second.getByRole('button', { name: '+ Add cabinet' }).click()
  await expect(first.locator('.module-row')).toHaveCount(2)
  await expect(first.getByLabel('Design name')).toHaveValue('From first tab')
})
