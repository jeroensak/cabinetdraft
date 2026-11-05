import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'

const project = readFileSync('e2e/saved-project.json', 'utf8')

/** Starts from a returning user's saved design. Only fills empty storage, so
 * tests that reload still read back what they saved. */
export async function seedSavedProject(page: Page) {
  await page.addInitScript((saved) => {
    const key = 'cabinet-designer:project:v1'
    if (!localStorage.getItem(key)) localStorage.setItem(key, saved)
  }, project)
}
