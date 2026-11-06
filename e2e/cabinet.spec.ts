import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { seedSavedProject } from './seed.js'

async function dimension(page: Page, name: string, value: string) {
  const field = page.getByLabel(`${name} (mm)`, { exact: true })
  await field.fill(value)
  await field.press('Enter')
}

// Every test gets a fresh browser context, then a saved default project.
test.beforeEach(async ({ page }) => {
  await seedSavedProject(page)
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
  await page.getByRole('checkbox', { name: 'Group identical parts' }).uncheck()
  await expect(page.getByRole('row')).toHaveCount(11)
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
  await page.getByRole('checkbox', { name: 'Group identical parts' }).uncheck()
  await expect(page.getByRole('row')).toHaveCount(18)
  await expect(
    page.getByRole('row').filter({ hasText: 'C2-SHELF-1' }),
  ).toContainText('864')
  await expect(
    page.getByRole('row').filter({ hasText: 'C2-DOOR-1' }),
  ).toContainText('896')
  await page.reload()
  await page.getByRole('checkbox', { name: 'Group identical parts' }).uncheck()
  await expect(page.getByRole('row')).toHaveCount(18)
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

test('space dividers create selectable spaces and exact Cut List panels', async ({
  page,
}, testInfo) => {
  await page
    .getByRole('button', { name: 'Cabinet 1 space 1', exact: true })
    .click()
  await page.getByRole('button', { name: 'Add divider', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Cabinet 1 space 1' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Cabinet 1 space 2' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Cabinet 1 divider at 391 mm' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Cabinet 1 space 1' }).click()
  await expect(
    page.getByText('373 mm free width · 1073 mm free height'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Add divider', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Cabinet 1 space 3' }),
  ).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('dividers.png') })
  await page
    .getByRole('button', { name: 'Cabinet 1 divider at 196 mm' })
    .click()
  await dimension(page, 'Divider left', '200')
  await page.getByRole('link', { name: 'Cut List', exact: true }).click()
  await expect(
    page.getByRole('row').filter({ hasText: 'C1-DIVIDER-1' }),
  ).toContainText('1073')
  await expect(
    page.getByRole('row').filter({ hasText: 'C1-DIVIDER-2' }),
  ).toContainText('597')
  await page.reload()
  await expect(
    page.getByRole('row').filter({ hasText: 'C1-DIVIDER-2' }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Designer', exact: true }).click()
  await page
    .getByRole('button', { name: 'Cabinet 1 divider at 200 mm' })
    .click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Cabinet 1 divider at 200 mm' }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Cabinet 1 divider at 200 mm' }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Cabinet 1 divider at 200 mm' })
    .click()
  await dimension(page, 'Divider left', '17')
  await page.getByRole('link', { name: 'Cut List', exact: true }).click()
  await expect(
    page.getByText('Cut list unavailable', { exact: true }),
  ).toBeVisible()
  await page.reload()
  await page.getByRole('link', { name: 'Designer', exact: true }).click()
  await page
    .getByRole('button', { name: 'Cabinet 1, 800 mm', exact: true })
    .click()
  await page.getByRole('button', { name: 'Select divider 1 at 17 mm' }).click()
  await dimension(page, 'Divider left', '200')
  await page.getByRole('link', { name: 'Cut List', exact: true }).click()
  await expect(
    page.getByRole('row').filter({ hasText: 'C1-DIVIDER-1' }),
  ).toBeVisible()
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
  await page.getByRole('button', { name: 'Import, export and share' }).click()
  await page.getByRole('menuitem', { name: 'Export' }).click()
  const download = await downloadReady
  expect(download.suggestedFilename()).toBe('untitled-cabinet.json')
  const file = testInfo.outputPath('project.json')
  await download.saveAs(file)
  const exported = JSON.parse(await readFile(file, 'utf8'))
  expect(Object.keys(exported).sort()).toEqual([
    'drawerDesigns',
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
  await page.getByRole('button', { name: 'Import, export and share' }).click()
  await page.getByRole('menuitem', { name: 'Export' }).click()
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

test('divider openings support partial shelves, spanning doors and batch drawers with undo and persistence', async ({
  page,
}, testInfo) => {
  await page.getByRole('button', { name: '+ Add cabinet', exact: true }).click()
  await page
    .getByRole('button', { name: 'Cabinet 2 space 1', exact: true })
    .click()
  await page.getByRole('button', { name: 'Add divider', exact: true }).click()
  await expect(
    page.getByRole('button', { name: /Cabinet 2 space \d+$/ }),
  ).toHaveCount(2)
  await page
    .getByRole('button', { name: 'Cabinet 2 space 1', exact: true })
    .click()
  await page.getByRole('button', { name: 'Add shelf', exact: true }).click()
  await expect(
    page.getByRole('button', { name: /Cabinet 2 space \d+$/ }),
  ).toHaveCount(3)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await page
    .getByRole('button', { name: 'Cabinet 2 space 1', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Cabinet 2 space 2', exact: true })
    .click({ modifiers: ['Shift'] })
  await expect(page.getByText('2 selected spaces')).toBeVisible()
  await page.getByRole('button', { name: 'Add shelf', exact: true }).click()
  await expect(
    page.getByRole('button', { name: /Cabinet 2 space \d+$/ }),
  ).toHaveCount(4)
  await expect(
    page.getByRole('button', { name: 'Cabinet 2 shelf at 1091 mm' }),
  ).toHaveCount(2)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(
    page.getByRole('button', { name: /Cabinet 2 space \d+$/ }),
  ).toHaveCount(2)
  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  await page.getByRole('button', { name: 'Fronts', exact: true }).click()
  await page
    .getByRole('button', { name: 'Cabinet 2 space 1', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Cabinet 2 space 3', exact: true })
    .click({ modifiers: ['Shift'] })
  await page.getByRole('button', { name: 'Add door', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Cabinet 2 single door 1' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Cabinet 2 space 1', exact: true }),
  ).toHaveCount(0)
  await page
    .getByRole('button', { name: 'Cabinet 2 space 2', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Cabinet 2 space 4', exact: true })
    .click({ modifiers: ['Shift'] })
  await page.getByRole('button', { name: 'Add drawer', exact: true }).click()
  await page
    .getByRole('button', { name: '+ New drawer design', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'Apply to 2 selected spaces', exact: true })
    .click()
  await page.getByRole('button', { name: 'Fronts', exact: true }).click()
  await expect(
    page.getByRole('button', { name: /Cabinet 2 drawer front/ }),
  ).toHaveCount(2)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await expect(
    page.getByRole('button', { name: /Cabinet 2 drawer front/ }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  await page.screenshot({ path: testInfo.outputPath('scoped-fronts.png') })
  await page.getByRole('link', { name: 'Cut List', exact: true }).click()
  const shelf = page.getByRole('row').filter({ hasText: 'C2-SHELF-1' })
  await expect(shelf).toContainText('373')
  const door = page.getByRole('row').filter({ hasText: 'C2-DOOR-1' })
  await expect(door).toContainText('397')
  await expect(door).toContainText('2196')
  const drawer = page
    .getByRole('row')
    .filter({ hasText: 'C2-DRAWER-1' })
    .filter({ hasText: 'Drawer front' })
  await expect(drawer).toContainText('397')
  await expect(drawer).toContainText('1097')
  await page.reload()
  await expect(drawer).toBeVisible()
  await page.getByRole('link', { name: 'Designer', exact: true }).click()
  await expect(
    page.getByRole('button', { name: /Cabinet 2 space \d+$/ }),
  ).toHaveCount(4)
  await page.screenshot({ path: testInfo.outputPath('scoped-shelves.png') })
})

test('new designs start from a template, keep their name and survive a reload', async ({
  page,
}) => {
  const picker = page.getByRole('combobox', { name: 'Current design' })
  await page.getByLabel('Design name').fill('Kitchen')
  await page.getByLabel('Design name').press('Enter')
  await page.getByRole('button', { name: '+ New design' }).click()
  await page.getByRole('radio').nth(2).check()
  await page.getByLabel('Name', { exact: true }).fill('Hall')
  await page.getByRole('button', { name: 'Create design' }).click()
  await expect(picker).toHaveValue(/.+/)
  await expect(page.getByLabel('Design name')).toHaveValue('Hall')
  await page.reload()
  await expect(page.getByLabel('Design name')).toHaveValue('Hall')
  await page
    .getByRole('combobox', { name: 'Current design' })
    .selectOption({ label: 'Kitchen' })
  await expect(page.getByLabel('Design name')).toHaveValue('Kitchen')

  page.once('dialog', (dialog) => dialog.dismiss())
  await page.getByRole('button', { name: 'Delete design' }).click()
  await expect(page.getByLabel('Design name')).toHaveValue('Kitchen')
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Delete design' }).click()
  await expect(page.getByLabel('Design name')).toHaveValue('Hall')
  await expect(
    page.getByRole('button', { name: 'Delete design' }),
  ).toBeDisabled()
  await page.reload()
  await expect(page.getByLabel('Design name')).toHaveValue('Hall')
})

test('the language picker translates the app and is remembered, without touching the design', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Language' }).click()
  await page.getByRole('menuitemradio', { name: 'Nederlands' }).click()
  await expect(page.getByRole('link', { name: 'Zaaglijst' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'nl')
  await page.reload()
  await expect(page.getByRole('link', { name: 'Zaaglijst' })).toBeVisible()
  await page.getByRole('link', { name: 'Zaaglijst' }).click()
  await expect(
    page.getByRole('heading', { name: 'Zaaglijst', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('row').filter({ hasText: 'C1-SIDE-L' }),
  ).toContainText('Zijkant')
  await page.getByRole('button', { name: 'Taal' }).click()
  await page.getByRole('menuitemradio', { name: 'English' }).click()
  await expect(page.getByRole('heading', { name: 'Cut List' })).toBeVisible()
})

test('an inch design stays in fractions through the designer, cut list and reload', async ({
  page,
}) => {
  await page.getByRole('button', { name: '+ New design' }).click()
  await page.getByRole('radio').nth(0).check()
  await page.getByLabel('Name', { exact: true }).fill('Shop cabinet')
  await page.getByRole('combobox', { name: 'Units' }).selectOption('inch')
  await page.getByRole('button', { name: 'Create design' }).click()
  await page.getByRole('button', { name: /^Cabinet 1, / }).click()
  const width = page.getByRole('textbox', { name: 'width (in)' })
  await width.fill('31 1/2')
  await width.press('Enter')
  await expect(
    page.getByRole('button', { name: 'Cabinet 1, 31 1/2"', exact: true }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Cut List', exact: true }).click()
  await expect(
    page.getByRole('columnheader', { name: 'Length (in)' }).first(),
  ).toBeVisible()
  await expect(
    page.getByRole('row').filter({ hasText: 'C1-TOP' }),
  ).toContainText('30')
  await page.reload()
  await expect(
    page.getByRole('columnheader', { name: 'Length (in)' }).first(),
  ).toBeVisible()
})

test('plans sheets, replans on every setting and survives a reload', async ({
  page,
}) => {
  await page.getByRole('link', { name: 'Cut List', exact: true }).click()
  await page.getByRole('button', { name: 'Sheets', exact: true }).click()
  const total = page.locator('.sheet-total')
  await expect(total).toContainText('4 sheets')
  await expect(page.getByRole('img')).toHaveCount(4)
  await expect(page.locator('.sheet-part')).toHaveCount(8)
  await expect(page.locator('.sheet-part-label')).toHaveCount(8)

  await page.getByLabel('Sheet size').selectOption('2800x2070')
  await expect(total).toContainText('3 sheets')
  await page.getByLabel('Sheet size').selectOption('custom')
  await page.getByLabel('Sheet length (mm)').fill('2000')
  await page.getByLabel('Sheet length (mm)').press('Enter')
  await expect(page.getByRole('alert')).toContainText('C1-SIDE-L')
  await page.getByLabel('Sheet length (mm)').fill('2300')
  await page.getByLabel('Sheet length (mm)').press('Enter')
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.getByLabel('Saw kerf (mm)').fill('5')
  await page.getByLabel('Saw kerf (mm)').press('Enter')
  await page.getByLabel('Optimise for').selectOption('sheets')

  await page.reload()
  await page.getByRole('button', { name: 'Sheets', exact: true }).click()
  await expect(page.getByLabel('Sheet size')).toHaveValue('custom')
  await expect(page.getByLabel('Sheet length (mm)')).toHaveValue('2300')
  await expect(page.getByLabel('Saw kerf (mm)')).toHaveValue('5')
  await expect(page.getByLabel('Optimise for')).toHaveValue('sheets')

  // The parts list is untouched, and a design edit reaches the drawings.
  await page.getByRole('button', { name: 'Parts', exact: true }).click()
  await expect(page.getByRole('row', { name: /C1-SIDE-L/ })).toBeVisible()
  await page.getByRole('button', { name: 'Sheets', exact: true }).click()
  await page.getByRole('link', { name: 'Back to Designer' }).click()
  await page
    .getByRole('button', { name: 'Cabinet 1, 800 mm', exact: true })
    .click()
  await dimension(page, 'height', '2000')
  await page.getByRole('link', { name: 'Cut List', exact: true }).click()
  await page.getByRole('button', { name: 'Sheets', exact: true }).click()
  await expect(page.getByRole('img').first()).toHaveAccessibleName(/sheet 1/i)
  await expect(page.locator('.sheet-part title').first()).toContainText(
    /2,?000|1,?996/,
  )
})
