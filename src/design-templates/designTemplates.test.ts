import { expect, it } from 'vitest'
import { deriveCutList } from '../domain/cutlist/deriveCutList'
import { defaultDrawerDesign } from '../domain/drawers/types'
import { convertToInches } from '../domain/project/convertToInches'
import { parseProject } from '../domain/import-export/projectJson'
import { validateProject } from '../domain/validation/validateProject'
import { setLanguage } from '../i18n'
import { designTemplates, localizedTemplate } from './index'

it('ships exactly three valid starting templates', () => {
  expect(designTemplates.map((template) => template.id)).toStrictEqual([
    './template-1.json',
    './template-2.json',
    './template-3.json',
  ])
  for (const template of designTemplates)
    expect(validateProject(parseProject(template.raw))).toStrictEqual([])
  expect(designTemplates.map((template) => template.name)).toStrictEqual([
    'Empty cabinet',
    'Wave drawer sideboard',
    'Drawers and door',
  ])
})

it('gives a valid, cuttable inch design from every template', () => {
  for (const template of designTemplates) {
    const project = convertToInches(parseProject(template.raw))
    expect(validateProject(project), template.id).toStrictEqual([])
    expect(deriveCutList(project).available, template.id).toBe(true)
  }
})

it('uses the default 18 mm drawer walls in every template', () => {
  const walls = designTemplates.flatMap((template) =>
    parseProject(template.raw).drawerDesigns.map(
      (design) => design.wallThickness,
    ),
  )
  expect(walls).toStrictEqual([18, 18, 18])
  expect(defaultDrawerDesign().wallThickness).toBe(18)
})

it('translates the names inside a template without changing its design', () => {
  const raw = designTemplates[1]!.raw
  setLanguage('nl')
  try {
    const project = parseProject(localizedTemplate(raw))
    expect(project.modules.map((module) => module.name)).toStrictEqual([
      'Brede kast',
      'Enkele kast',
      'Kast 1',
    ])
    expect(project.drawerDesigns.map((design) => design.name)).toStrictEqual([
      'Lade met golffront',
      'Grote lade',
    ])
    expect(project.modules[0]!.fronts).toStrictEqual(
      parseProject(raw).modules[0]!.fronts,
    )
  } finally {
    setLanguage('en')
  }
})
