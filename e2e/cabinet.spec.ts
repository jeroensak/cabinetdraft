import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

async function dimension(page: Page, name: string, value: string) {
  const field = page.getByLabel(`${name} (mm)`, { exact: true })
  await field.fill(value)
  await field.press('Enter')
}

// Every test gets a fresh browser context and localStorage automatically.
test.beforeEach(async ({ page }) => {
  await page.goto('/designer')
})

test('default design produces the expected physical parts', async ({
  page,
}) => {
  await expect(
    page.getByRole('button', { name: 'Cabinet 1, 800 mm', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Cabinet 1 shelf at 1091 mm' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Fronts', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Cabinet 1 double door 1' }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Cut List', exact: true }).click()
  await expect(page.getByRole('row')).toHaveCount(9)
  await expect(
    page.getByRole('row').filter({ hasText: 'C1-SIDE-L' }),
  ).toContainText('597')
  await expect(
    page.getByRole('row').filter({ hasText: 'C1-DOOR-1-L' }),
  ).toContainText('2196')
  await expect(
    page.getByRole('row').filter({ hasText: 'C1-DOOR-1-R' }),
  ).toContainText('397')
})

test('new resized cabinet, shelf and door update manufacturing output and survive reload', async ({
  page,
}) => {
  await page.getByRole('button', { name: '+ Add cabinet', exact: true }).click()
  await dimension(page, 'width', '900')
  await page
    .getByRole('button', { name: 'Cabinet 2 space 1', exact: true })
    .click()
  await page.getByRole('button', { name: 'Add shelf', exact: true }).click()
  await page
    .getByRole('button', { name: 'Cabinet 2 space 1', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Cabinet 2 space 2', exact: true })
    .click({ modifiers: ['Shift'] })
  await page.getByRole('button', { name: 'Add door', exact: true }).click()
  await page.getByRole('link', { name: 'Cut List', exact: true }).click()
  await expect(page.getByRole('row')).toHaveCount(16)
  await expect(
    page.getByRole('row').filter({ hasText: 'C2-SHELF-1' }),
  ).toContainText('864')
  await expect(
    page.getByRole('row').filter({ hasText: 'C2-DOOR-1' }),
  ).toContainText('896')
  await page.reload()
  await expect(page.getByRole('row')).toHaveCount(16)
  await page.getByRole('link', { name: 'Designer', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Cabinet 2, 900 mm', exact: true }),
  ).toBeVisible()
})

test('invalid dimensions block usable cut-list output', async ({ page }) => {
  await page
    .getByRole('button', { name: 'Cabinet 1, 800 mm', exact: true })
    .click()
  await dimension(page, 'width', '10')
  await expect(page.getByText('! Invalid geometry').first()).toBeVisible()
  await page.getByRole('link', { name: 'Cut List', exact: true }).click()
  await expect(
    page.getByText('Cut list unavailable', { exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('table')).toHaveCount(0)
})

test('one committed edit is one undo and redo step', async ({ page }) => {
  await page
    .getByRole('button', { name: 'Cabinet 1, 800 mm', exact: true })
    .click()
  await dimension(page, 'width', '900')
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(page.getByLabel('width (mm)', { exact: true })).toHaveValue(
    '800',
  )
  await expect(
    page.getByRole('button', { name: 'Undo', exact: true }),
  ).toBeDisabled()
  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  await expect(page.getByLabel('width (mm)', { exact: true })).toHaveValue(
    '900',
  )
  await expect(
    page.getByRole('button', { name: 'Redo', exact: true }),
  ).toBeDisabled()
})

test('export and confirmed import restore the full design', async ({
  page,
}, testInfo) => {
  const downloadReady = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  const download = await downloadReady
  expect(download.suggestedFilename()).toBe('untitled-cabinet.json')
  const file = testInfo.outputPath('project.json')
  await download.saveAs(file)
  const exported = JSON.parse(await readFile(file, 'utf8'))
  expect(Object.keys(exported).sort()).toEqual([
    'id',
    'modules',
    'name',
    'schemaVersion',
    'settings',
  ])
  await page
    .getByRole('button', { name: 'Cabinet 1, 800 mm', exact: true })
    .click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByText('No cabinets to display')).toBeVisible()
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toBe(
      'Replace current design with imported project?',
    )
    await dialog.accept()
  })
  await page
    .getByLabel('Import project file', { exact: true })
    .setInputFiles(file)
  await expect(
    page.getByRole('button', { name: 'Cabinet 1 shelf at 1091 mm' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Fronts', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Cabinet 1 double door 1' }),
  ).toBeVisible()
  const restoredDownloadReady = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  const restoredFile = testInfo.outputPath('restored.json')
  await (await restoredDownloadReady).saveAs(restoredFile)
  expect(JSON.parse(await readFile(restoredFile, 'utf8'))).toEqual(exported)
})

test('downloads single and multiple page cut-list PDFs', async ({
  page,
}, testInfo) => {
  await page.getByRole('link', { name: 'Cut List', exact: true }).click()
  const firstDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download PDF', exact: true }).click()
  const single = await firstDownload
  expect(single.suggestedFilename()).toBe('untitled-cabinet-cut-list.pdf')
  const singlePath = testInfo.outputPath('single-page.pdf')
  await single.saveAs(singlePath)
  await page.screenshot({ path: testInfo.outputPath('cut-list.png') })
  expect((await readFile(singlePath)).subarray(0, 5).toString()).toBe('%PDF-')
  await page.getByRole('link', { name: 'Designer', exact: true }).click()
  for (let i = 0; i < 12; i++)
    await page
      .getByRole('button', { name: '+ Add cabinet', exact: true })
      .click()
  await page.getByLabel('Name', { exact: true }).fill('Étagère – entrée')
  await page.getByLabel('Name', { exact: true }).press('Enter')
  await page.getByRole('link', { name: 'Cut List', exact: true }).click()
  const nextDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download PDF', exact: true }).click()
  await (await nextDownload).saveAs(testInfo.outputPath('multiple-pages.pdf'))
})
