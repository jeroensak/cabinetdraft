import { expect, it } from 'vitest'
import { deriveCutList } from '../domain/cutlist/deriveCutList'
import { defaultDrawerDesign } from '../domain/drawers/types'
import { convertToInches } from '../domain/project/convertToInches'
import { parseProject } from '../domain/import-export/projectJson'
import { validateProject } from '../domain/validation/validateProject'
import { setLanguage, t } from '../i18n'
import { designTemplates, localizedTemplate } from './index'

it('ships exactly five valid starting templates', () => {
  expect(designTemplates.map((template) => template.id)).toStrictEqual([
    './template-1.json',
    './template-2.json',
    './template-3.json',
    './template-4.json',
    './template-5.json',
  ])
  for (const template of designTemplates)
    expect(validateProject(parseProject(template.raw))).toStrictEqual([])
  expect(designTemplates.map((template) => template.name)).toStrictEqual([
    'Empty cabinet',
    'Drawers and door',
    'Media wall',
    'Record cabinet',
    'Gallery wall',
  ])
  for (const template of designTemplates)
    expect(t(template.key), template.id).toBe(template.name)
})

it('makes the media wall a large, varied five-cabinet run', () => {
  const { modules } = parseProject(designTemplates[2]!.raw)
  const total = modules.reduce((sum, module) => sum + module.width, 0)
  expect(total).toBe(5000)
  expect(new Set(modules.map((module) => module.height)).size).toBe(5)
  const fronts = modules.flatMap((module) => module.fronts)
  expect(new Set(fronts.map((front) => front.type))).toStrictEqual(
    new Set(['door', 'drawer']),
  )
  const shelves = modules.flatMap((module) => module.shelves)
  expect(shelves.some((shelf) => shelf.leftBoundary)).toBe(true)
  expect(shelves.some((shelf) => shelf.rightBoundary)).toBe(true)
})

it('builds the record cabinet as five wave drawers over a double door', () => {
  const project = parseProject(designTemplates[3]!.raw)
  const [module] = project.modules
  expect(module).toMatchObject({ width: 1978, height: 810, depth: 420 })
  expect(module!.shelves.map((shelf) => shelf.bottom)).toStrictEqual([404])
  expect(module!.dividers.map((divider) => divider.left)).toStrictEqual([
    392, 784, 1176, 1568, 490, 980, 1470,
  ])

  const cutList = deriveCutList(project)
  if (!cutList.available) throw new Error('The cut list should be available')
  const parts = new Map<string, number>()
  for (const { part, length, width, thickness, waveDip } of cutList.items) {
    const row = [part, length, width, thickness, waveDip ?? 0].join(' ')
    parts.set(row, (parts.get(row) ?? 0) + 1)
  }
  expect(Object.fromEntries(parts)).toStrictEqual({
    'side-left 810 410 18 0': 1,
    'side-right 810 410 18 0': 1,
    'top 1942 410 18 0': 1,
    'bottom 1942 410 18 0': 1,
    'shelf 1942 410 18 0': 1,
    'divider 370 410 18 0': 4,
    'divider 386 390 18 0': 3,
    'back 810 1978 10 0': 1,
    'drawer 220 370 18 33': 5,
    'door 382 968 18 0': 2,
    'drawer-side-left 152 340 16 0': 5,
    'drawer-side-right 152 340 16 0': 5,
    'drawer-box-front 152 332 16 0': 5,
    'drawer-box-back 152 332 16 0': 5,
    'drawer-bottom 348 324 16 0': 5,
  })
})

it('keeps the gallery wall symmetrical and its heights in the golden ratio', () => {
  const { modules } = parseProject(designTemplates[4]!.raw)
  const sizes = modules.map(({ width, height }) => [width, height])
  expect(sizes).toStrictEqual(sizes.toReversed())
  const [tower, step, bench] = modules
  expect(tower!.height / step!.height).toBeCloseTo(1.62, 2)
  expect(step!.height / bench!.height).toBeCloseTo(1.62, 2)
})

it('gives a valid, cuttable inch design from every template', () => {
  for (const template of designTemplates) {
    const project = convertToInches(parseProject(template.raw))
    expect(validateProject(project), template.id).toStrictEqual([])
    expect(deriveCutList(project).available, template.id).toBe(true)
  }
})

it('uses the default 18 mm drawer walls, except in the 16 mm record drawer', () => {
  const walls = designTemplates.flatMap((template) =>
    parseProject(template.raw).drawerDesigns.map(
      (design) => design.wallThickness,
    ),
  )
  expect(walls).toStrictEqual([18, 18, 18, 16, 18])
  expect(defaultDrawerDesign().wallThickness).toBe(18)
})

it('translates the names inside a template without changing its design', () => {
  const raw = designTemplates[2]!.raw
  setLanguage('nl')
  try {
    const project = parseProject(localizedTemplate(raw))
    expect(project.modules.map((module) => module.name)).toStrictEqual([
      'Hoge kast',
      'Open kast',
      'Tv-meubel',
      'Boekenkast',
      'Ladetoren',
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

it.each([
  [
    'en',
    'Gallery wall',
    ['Left tower', 'Left step', 'Centre bench', 'Right step', 'Right tower'],
  ],
  [
    'nl',
    'Galerijwand',
    [
      'Linkertoren',
      'Linkertrede',
      'Middenbank',
      'Rechtertrede',
      'Rechtertoren',
    ],
  ],
  [
    'de',
    'Galeriewand',
    [
      'Linker Turm',
      'Linke Stufe',
      'Mittelbank',
      'Rechte Stufe',
      'Rechter Turm',
    ],
  ],
  [
    'fr',
    'Mur galerie',
    [
      'Tour gauche',
      'Gradin gauche',
      'Banc central',
      'Gradin droit',
      'Tour droite',
    ],
  ],
] as const)('labels the gallery wall in %s', (language, name, cabinets) => {
  const template = designTemplates[4]!
  setLanguage(language)
  try {
    expect(t(template.key)).toBe(name)
    const { modules } = parseProject(localizedTemplate(template.raw))
    expect(modules.map((module) => module.name)).toStrictEqual(cabinets)
  } finally {
    setLanguage('en')
  }
})
