import { describe, expect, it } from 'vitest'
import { createDefaultProject } from './createDefaultProject'
import type { Project } from './types'

function sequentialIds() {
  let next = 0
  return () => `id-${++next}`
}

describe('createDefaultProject', () => {
  it('creates exactly the specified persistent default shape', () => {
    const project = createDefaultProject(sequentialIds())

    expect(project).toStrictEqual({
      schemaVersion: 1,
      id: 'id-1',
      name: 'Untitled cabinet',
      settings: {
        corpusThickness: 18,
        backPanelEnabled: true,
        backPanelThickness: 3,
        frontThickness: 18,
        frontGap: 2,
      },
      modules: [
        {
          id: 'id-2',
          name: 'Cabinet 1',
          width: 800,
          height: 2200,
          depth: 600,
          shelves: [{ id: 'id-3', bottom: 1091 }],
          fronts: [
            {
              id: 'id-4',
              type: 'door',
              leaves: 2,
              bottomBoundary: { type: 'module-bottom' },
              topBoundary: { type: 'module-top' },
            },
          ],
        },
      ],
    })
    expect(JSON.parse(JSON.stringify(project))).toStrictEqual(project)
  })

  it('centres the shelf with equal free heights, accounting for panel thickness', () => {
    const project = createDefaultProject(sequentialIds())
    const module = project.modules[0]!
    const shelf = module.shelves[0]!
    const thickness = project.settings.corpusThickness

    expect(shelf.bottom).toBe(1091)
    expect(shelf.bottom - thickness).toBe(1073)
    expect(module.height - thickness - (shelf.bottom + thickness)).toBe(1073)
  })

  it('allocates fresh IDs for each persistent object across projects', () => {
    const ids = [createDefaultProject(), createDefaultProject()].flatMap(
      (project) => [
        project.id,
        ...project.modules.flatMap((module) => [
          module.id,
          ...module.shelves.map((shelf) => shelf.id),
          ...module.fronts.map((front) => front.id),
        ]),
      ],
    )

    expect(ids).toHaveLength(8)
    expect(new Set(ids).size).toBe(8)
    for (const id of ids) {
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      )
    }
  })

  it('returns independent nested objects on every call', () => {
    const first = createDefaultProject(sequentialIds())
    const second = createDefaultProject(sequentialIds())
    const expected = createDefaultProject(sequentialIds())
    first.settings.frontGap = 4
    const module = first.modules[0]!
    module.width = 900
    module.shelves[0]!.bottom = 1000
    module.shelves.push({ id: 'extra-shelf', bottom: 1500 })
    module.fronts[0]!.bottomBoundary.type = 'module-top'
    module.fronts.pop()
    first.modules.push({ ...module, id: 'extra-module' })

    expect(second).toStrictEqual(expected)
  })

  it('represents shelf-bound drawer fronts and geometrically invalid dimensions', () => {
    // Representation only: validation and commands belong to later slices.
    const project: Project = createDefaultProject(sequentialIds())
    const module = project.modules[0]!
    module.height = 800
    module.fronts = [
      {
        id: 'drawer',
        type: 'drawer',
        bottomBoundary: { type: 'module-bottom' },
        topBoundary: { type: 'shelf', shelfId: module.shelves[0]!.id },
      },
    ]

    expect(module.shelves[0]!.bottom).toBe(1091)
    expect(JSON.parse(JSON.stringify(project))).toStrictEqual(project)
  })
})
