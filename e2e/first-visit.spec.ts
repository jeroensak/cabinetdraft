import { test, expect } from '@playwright/test'

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
