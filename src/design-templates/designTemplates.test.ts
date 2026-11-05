import { expect, it } from 'vitest'
import { parseProject } from '../domain/import-export/projectJson'
import { validateProject } from '../domain/validation/validateProject'
import { designTemplates } from './index'

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
