import { describe, expect, it } from 'vitest'
import { createDefaultProject } from '../project/createDefaultProject'
import type { Project } from '../project/types'
import { validateProject, type ValidationCode } from './validateProject'

function fixture() {
  let id = 0
  return createDefaultProject(() => `id-${++id}`)
}

describe('validateProject', () => {
  it('accepts the default project', () => {
    expect(validateProject(fixture())).toStrictEqual([])
  })

  const cases: [string, (project: Project) => void, ValidationCode][] = [
    [
      'width at two side thicknesses',
      (p) => {
        p.modules[0]!.width = 36
      },
      'invalid-internal-width',
    ],
    [
      'width below two side thicknesses',
      (p) => {
        p.modules[0]!.width = 35
      },
      'invalid-internal-width',
    ],
    [
      'height at two panel thicknesses',
      (p) => {
        p.modules[0]!.height = 36
      },
      'invalid-interior-height',
    ],
    [
      'height below two panel thicknesses',
      (p) => {
        p.modules[0]!.height = 35
      },
      'invalid-interior-height',
    ],
    [
      'depth equal to back thickness',
      (p) => {
        p.modules[0]!.depth = 3
      },
      'invalid-carcass-depth',
    ],
    [
      'depth below back thickness',
      (p) => {
        p.modules[0]!.depth = 2
      },
      'invalid-carcass-depth',
    ],
    [
      'shelf below interior',
      (p) => {
        p.modules[0]!.shelves[0]!.bottom = 17
      },
      'shelf-outside-interior',
    ],
    [
      'shelf intersecting top',
      (p) => {
        p.modules[0]!.shelves[0]!.bottom = 2175
      },
      'shelf-outside-interior',
    ],
    [
      'shelf touching bottom panel',
      (p) => {
        p.modules[0]!.shelves[0]!.bottom = 18
      },
      'invalid-space-height',
    ],
    [
      'shelf touching top panel',
      (p) => {
        p.modules[0]!.shelves[0]!.bottom = 2164
      },
      'invalid-space-height',
    ],
    [
      'overlapping shelves',
      (p) => {
        p.modules[0]!.shelves.push({ id: 'overlap', bottom: 1095 })
      },
      'invalid-space-height',
    ],
    [
      'coincident shelves',
      (p) => {
        p.modules[0]!.shelves.push({ id: 'coincident', bottom: 1091 })
      },
      'invalid-space-height',
    ],
    [
      'missing shelf reference',
      (p) => {
        p.modules[0]!.fronts[0]!.topBoundary = {
          type: 'shelf',
          shelfId: 'missing',
        }
      },
      'missing-front-boundary',
    ],
    [
      'fractional double door',
      (p) => {
        p.modules[0]!.width = 801
      },
      'fractional-front-dimension',
    ],
    [
      'nonpositive front size',
      (p) => {
        p.settings.frontGap = 400
      },
      'invalid-front-dimension',
    ],
    [
      'fractional carcass size',
      (p) => {
        p.modules[0]!.depth = 600.5
      },
      'invalid-panel-dimension',
    ],
    [
      'fractional shelf position',
      (p) => {
        p.modules[0]!.shelves[0]!.bottom = 1091.5
      },
      'invalid-measurement',
    ],
    [
      'zero thickness',
      (p) => {
        p.settings.corpusThickness = 0
      },
      'invalid-measurement',
    ],
    [
      'negative gap',
      (p) => {
        p.settings.frontGap = -2
      },
      'invalid-measurement',
    ],
    [
      'NaN height',
      (p) => {
        p.modules[0]!.height = NaN
      },
      'invalid-measurement',
    ],
    [
      'infinite depth',
      (p) => {
        p.modules[0]!.depth = Infinity
      },
      'invalid-measurement',
    ],
    [
      'duplicate ID',
      (p) => {
        p.modules[0]!.shelves[0]!.id = p.modules[0]!.id
      },
      'duplicate-id',
    ],
    [
      'reversed front range',
      (p) => {
        p.modules[0]!.fronts[0]!.bottomBoundary = { type: 'module-top' }
        p.modules[0]!.fronts[0]!.topBoundary = { type: 'module-bottom' }
      },
      'invalid-front-range',
    ],
    [
      'zero-space front',
      (p) => {
        p.modules[0]!.fronts[0]!.topBoundary = { type: 'module-bottom' }
      },
      'invalid-front-range',
    ],
    [
      'drawer spanning spaces',
      (p) => {
        p.modules[0]!.fronts = [
          {
            id: 'drawer',
            type: 'drawer',
            bottomBoundary: { type: 'module-bottom' },
            topBoundary: { type: 'module-top' },
          },
        ]
      },
      'drawer-must-cover-one-space',
    ],
  ]
  it.each(cases)('reports %s without altering data', (_name, change, code) => {
    const project = fixture()
    change(project)
    const before = structuredClone(project)
    expect(validateProject(project)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code })]),
    )
    expect(project).toStrictEqual(before)
  })

  it('identifies both fronts in an overlap, including a spanning door', () => {
    const project = fixture()
    const module = project.modules[0]!
    module.fronts.push({
      id: 'drawer',
      type: 'drawer',
      bottomBoundary: { type: 'module-bottom' },
      topBoundary: { type: 'shelf', shelfId: module.shelves[0]!.id },
    })
    expect(validateProject(project)).toContainEqual({
      code: 'overlapping-fronts',
      moduleId: module.id,
      frontId: 'drawer',
      data: { otherFrontId: module.fronts[0]!.id },
    })
  })

  it('allows adjacent front ranges to share a shelf boundary', () => {
    const project = fixture()
    const module = project.modules[0]!
    const boundary = { type: 'shelf' as const, shelfId: module.shelves[0]!.id }
    module.fronts[0]!.bottomBoundary = boundary
    module.fronts.push({
      id: 'drawer',
      type: 'drawer',
      bottomBoundary: { type: 'module-bottom' },
      topBoundary: boundary,
    })
    expect(validateProject(project)).toStrictEqual([])
  })

  it('accepts constructible small dimensions without furniture minimums', () => {
    const project = fixture()
    Object.assign(project.modules[0]!, {
      width: 37,
      height: 37,
      depth: 4,
      shelves: [],
      fronts: [],
    })
    expect(validateProject(project)).toStrictEqual([])
    project.settings.backPanelEnabled = false
    project.modules[0]!.depth = 1
    expect(validateProject(project)).toStrictEqual([])
  })

  it('does not treat fractional front placement as fractional panel size', () => {
    const project = fixture()
    const module = project.modules[0]!
    project.settings.corpusThickness = 19
    module.shelves = [
      { id: 'high', bottom: 1500 },
      { id: 'low', bottom: 500 },
    ]
    module.fronts[0]!.bottomBoundary = { type: 'shelf', shelfId: 'low' }
    module.fronts[0]!.topBoundary = { type: 'shelf', shelfId: 'high' }
    expect(validateProject(project)).toStrictEqual([])
  })
})
