/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { autoTable, type UserOptions } from 'jspdf-autotable'
import type { jsPDF } from 'jspdf'
import { beforeEach, expect, it, vi } from 'vitest'
import { designTemplates } from '../design-templates'
import { parseProject } from '../domain/import-export/projectJson'
import { convertToInches } from '../domain/project/convertToInches'
import { createDefaultProject } from '../domain/project/createDefaultProject'
import { setLanguage } from '../i18n'
import { createCutListPdf } from './cutListPdf'

vi.mock('jspdf-autotable', async (original) => {
  const real = await original<typeof import('jspdf-autotable')>()
  return {
    ...real,
    autoTable: vi.fn((doc: jsPDF, options: UserOptions) => {
      if (!vi.isMockFunction(doc.text)) vi.spyOn(doc, 'text')
      return real.autoTable(doc, options)
    }),
  }
})
beforeEach(() => {
  vi.mocked(autoTable).mockClear()
})

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
const tables = () =>
  vi.mocked(autoTable).mock.calls.map(([, options]) => options as UserOptions)
const drawnText = (pdf: jsPDF) =>
  vi.mocked(pdf.text).mock.calls.map(([text]) => String(text))

it('leaves the table as it was while edge banding is off', () => {
  const pdf = createCutListPdf(createDefaultProject(), font)
  for (const table of tables()) expect(table.head![1]).toHaveLength(7)
  expect(drawnText(pdf).join(' ')).not.toContain('banding')
})
it('adds the banded edges of each row and the total on the list pages', () => {
  const project = createDefaultProject()
  project.settings.edgeBanding = true
  const pdf = createCutListPdf(project, font)
  const head = tables()[0]!.head![1] as string[]
  expect(head.at(-1)).toBe('Edge banding')
  const cells = tables().flatMap((table) =>
    (table.body as string[][]).map((row) => row.at(-1)),
  )
  expect(new Set(cells)).toStrictEqual(
    new Set(['Front edge', 'None', 'All 4 edges']),
  )
  const text = drawnText(pdf)
  expect(text.filter((line) => line.includes('Edge banding needed'))).toEqual([
    expect.stringMatching(
      /Configuration valid {2}· {2}Edge banding needed: [\d,]+ mm$/,
    ),
  ])
})
it('states an inch total in plain inches', () => {
  const project = convertToInches(createDefaultProject())
  project.settings.edgeBanding = true
  const text = drawnText(createCutListPdf(project, font))
  expect(text.join(' ')).toMatch(/Edge banding needed: [\d /]+"/)
})
