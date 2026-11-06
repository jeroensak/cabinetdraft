/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { designTemplates } from '../design-templates'
import { parseProject } from '../domain/import-export/projectJson'
import { createDefaultProject } from '../domain/project/createDefaultProject'
import { setLanguage } from '../i18n'
import { createCutListPdf } from './cutListPdf'

const font = readFileSync(
  new URL('../assets/fonts/NotoSans-Regular.ttf', import.meta.url),
).toString('base64')
it('creates a PDF for the default cabinet and paginates large cut lists', () => {
  const project = createDefaultProject()
  expect(createCutListPdf(project, font).getNumberOfPages()).toBe(6)
  const module = project.modules[0]
  project.modules = Array.from({ length: 20 }, (_, i) => ({
    ...module,
    id: `module-${i}`,
    name: `Cabinet ${i + 1} – Étagère`,
    shelves: [],
    fronts: [],
  }))
  const pdf = createCutListPdf(project, font)
  expect(pdf.getNumberOfPages()).toBeGreaterThan(20)
  expect(pdf.output().startsWith('%PDF-')).toBe(true)
})
it('puts the sheets between the lists and the assembly pages', () => {
  const pdf = createCutListPdf(createDefaultProject(), font)
  // One list, four sheets, one cabinet.
  expect(pdf.getNumberOfPages()).toBe(1 + 4 + 1)
})
it('refuses invalid and empty projects even outside the UI', () => {
  const project = createDefaultProject()
  project.modules[0].width = 801
  expect(() => createCutListPdf(project, font)).toThrow('No valid cut list')
  project.modules = []
  expect(() => createCutListPdf(project, font)).toThrow('No valid cut list')
})
it.each(['nl', 'de', 'fr'] as const)('creates a %s PDF', (language) => {
  setLanguage(language)
  try {
    const pdf = createCutListPdf(createDefaultProject(), font)
    expect(pdf.getNumberOfPages()).toBe(6)
  } finally {
    setLanguage('en')
  }
})
it('adds one assembly page per cabinet, for drawers and wave fronts too', () => {
  for (const template of designTemplates) {
    const project = parseProject(template.raw)
    const lists = createCutListPdf(project, font).getNumberOfPages()
    expect(lists).toBeGreaterThan(project.modules.length)
  }
})
