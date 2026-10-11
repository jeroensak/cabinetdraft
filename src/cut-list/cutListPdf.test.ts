/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { createDefaultProject } from '../domain/project/createDefaultProject'
import { createCutListPdf } from './cutListPdf'

const font = readFileSync(
  new URL('../assets/fonts/NotoSans-Regular.ttf', import.meta.url),
).toString('base64')
it('creates a PDF for the default cabinet and paginates large cut lists', () => {
  const project = createDefaultProject()
  expect(createCutListPdf(project, font).getNumberOfPages()).toBe(1)
  const module = project.modules[0]
  project.modules = Array.from({ length: 20 }, (_, i) => ({
    ...module,
    id: `module-${i}`,
    name: `Cabinet ${i + 1} – Étagère`,
    shelves: [],
    fronts: [],
  }))
  const pdf = createCutListPdf(project, font)
  expect(pdf.getNumberOfPages()).toBeGreaterThan(1)
  expect(pdf.output().startsWith('%PDF-')).toBe(true)
})
it('refuses invalid and empty projects even outside the UI', () => {
  const project = createDefaultProject()
  project.modules[0].width = 801
  expect(() => createCutListPdf(project, font)).toThrow('No valid cut list')
  project.modules = []
  expect(() => createCutListPdf(project, font)).toThrow('No valid cut list')
})
