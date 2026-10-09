import { describe, expect, it } from 'vitest'
import {
  addModule,
  duplicateModule,
  deleteModule,
  renameModule,
  renameProject,
  reorderModules,
  setModuleDimensions,
  updateProjectSettings,
} from './modules'
import { fixture, freeze, ids, rejects } from './testHelpers'
import { validateProject } from '../validation/validateProject'

describe('module and project commands', () => {
  it('adds an empty cabinet with defaults and a collision-safe name', () => {
    const project = fixture()
    const before = structuredClone(project)
    const next = addModule(freeze(project), ids())
    expect(next.modules[1]).toStrictEqual({
      id: 'new-1',
      name: 'Cabinet 2',
      width: 800,
      height: 2200,
      depth: 600,
      shelves: [],
      fronts: [],
    })
    expect(project).toStrictEqual(before)
    expect(validateProject(next)).toStrictEqual([])
  })

  it('duplicates all objects, remaps shelf boundaries, and inserts immediately to the right', () => {
    const project = fixture()
    const source = project.modules[0]!
    source.name = 'Wardrobe'
    source.fronts = [
      {
        id: 'lower',
        type: 'drawer',
        bottomBoundary: { type: 'module-bottom' },
        topBoundary: { type: 'shelf', shelfId: source.shelves[0]!.id },
      },
      {
        id: 'upper',
        type: 'door',
        leaves: 2,
        bottomBoundary: { type: 'shelf', shelfId: source.shelves[0]!.id },
        topBoundary: { type: 'module-top' },
      },
    ]
    project.modules.push({
      id: 'trailing',
      name: 'Wardrobe copy',
      width: 100,
      height: 100,
      depth: 100,
      shelves: [],
      fronts: [],
    })
    const next = duplicateModule(freeze(project), source.id, ids())
    const copy = next.modules[1]!
    expect(next.modules.map((module) => module.id)).toStrictEqual([
      source.id,
      'new-1',
      'trailing',
    ])
    expect(copy.name).toBe('Wardrobe copy 2')
    expect(copy.shelves).toStrictEqual([{ id: 'new-2', bottom: 1091 }])
    expect(copy.fronts.map((front) => front.id)).toStrictEqual([
      'new-3',
      'new-4',
    ])
    expect(copy.fronts[0]!.topBoundary).toStrictEqual({
      type: 'shelf',
      shelfId: 'new-2',
    })
    expect(copy.fronts[1]!.bottomBoundary).toStrictEqual({
      type: 'shelf',
      shelfId: 'new-2',
    })
    expect(validateProject(next)).toStrictEqual([])
    copy.shelves[0]!.bottom = 100
    copy.fronts[0]!.topBoundary.type = 'module-top'
    expect(next.modules[0]!.shelves[0]!.bottom).toBe(1091)
    expect(next.modules[0]!.fronts[0]!.topBoundary).toStrictEqual({
      type: 'shelf',
      shelfId: source.shelves[0]!.id,
    })
  })

  it('duplicates invalid geometry without fixing shelf positions', () => {
    const project = fixture()
    project.modules[0]!.height = 800
    const next = duplicateModule(freeze(project), project.modules[0]!.id, ids())
    expect(next.modules[1]!.height).toBe(800)
    expect(next.modules[1]!.shelves[0]!.bottom).toBe(1091)
    expect(
      validateProject(next).some(
        (issue) => issue.moduleId === next.modules[1]!.id,
      ),
    ).toBe(true)
  })

  it('deletes a module including its contents and allows an empty project', () => {
    const project = fixture()
    const next = deleteModule(freeze(project), project.modules[0]!.id)
    expect(next.modules).toStrictEqual([])
    expect(project.modules).toHaveLength(1)
  })

  it('renames projects and modules without changing their IDs', () => {
    const project = fixture()
    const named = renameProject(freeze(project), 'Bedroom')
    const next = renameModule(freeze(named), project.modules[0]!.id, 'Wardrobe')
    expect(next.name).toBe('Bedroom')
    expect(next.modules[0]!.name).toBe('Wardrobe')
    expect(next.id).toBe(project.id)
    expect(next.modules[0]!.id).toBe(project.modules[0]!.id)
  })

  it('reorders only the module array', () => {
    const project = addModule(fixture(), ids())
    const next = reorderModules(
      freeze(project),
      project.modules.map((module) => module.id).reverse(),
    )
    expect(next.modules).toStrictEqual([...project.modules].reverse())
    expect(next.modules[0]).not.toHaveProperty('order')
    expect(next.modules[0]).not.toHaveProperty('x')
  })

  it.each([
    { order: [] },
    { order: ['missing'] },
    { order: ['original-2', 'original-2'] },
  ])('rejects an invalid permutation $order', ({ order }) => {
    const project = fixture()
    rejects(
      project,
      () => reorderModules(project, order),
      'invalid-module-order',
    )
  })

  it('keeps shelves/fronts absolute on resize and allows geometric invalidity', () => {
    const project = fixture()
    const next = setModuleDimensions(freeze(project), project.modules[0]!.id, {
      width: 801,
      height: 800,
      depth: 2,
    })
    expect(next.modules[0]!.shelves).toStrictEqual(project.modules[0]!.shelves)
    expect(next.modules[0]!.fronts).toStrictEqual(project.modules[0]!.fronts)
    expect(validateProject(next).map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'shelf-outside-interior',
        'invalid-carcass-depth',
        'fractional-front-dimension',
      ]),
    )
  })

  it('updates global settings without repairing geometry or modifying input settings', () => {
    const project = fixture()
    const patch = freeze({
      corpusThickness: 500,
      backPanelEnabled: false,
      frontGap: 3,
    })
    const next = updateProjectSettings(freeze(project), patch)
    expect(next.settings).toStrictEqual({ ...project.settings, ...patch })
    expect(next.modules).toStrictEqual(project.modules)
    expect(validateProject(next).length).toBeGreaterThan(0)
  })

  it.each([1.5, NaN, Infinity])(
    'rejects a non-integer persisted measurement %s',
    (value) => {
      const project = fixture()
      rejects(
        project,
        () =>
          setModuleDimensions(project, project.modules[0]!.id, {
            width: value,
          }),
        'invalid-integer',
      )
      rejects(
        project,
        () => updateProjectSettings(project, { corpusThickness: value }),
        'invalid-integer',
      )
    },
  )

  it('rejects unknown modules and colliding IDs without partial edits', () => {
    const project = fixture()
    rejects(
      project,
      () => renameModule(project, 'missing', 'Name'),
      'module-not-found',
    )
    rejects(project, () => deleteModule(project, 'missing'), 'module-not-found')
    rejects(
      project,
      () => duplicateModule(project, 'missing', ids()),
      'module-not-found',
    )
    rejects(project, () => addModule(project, () => project.id), 'id-conflict')
    rejects(
      project,
      () => duplicateModule(project, project.modules[0]!.id, () => 'same'),
      'id-conflict',
    )
  })
})
