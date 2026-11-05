import { describe, expect, it } from 'vitest'
import { createDefaultProject } from '../project/createDefaultProject'
import { exportProject, parseProject, projectFilename } from './projectJson'
import { validateProject } from '../validation/validateProject'

describe('project JSON boundary', () => {
  it('migrates V1 projects without changing their physical design', () => {
    const v2 = createDefaultProject()
    const raw = JSON.stringify({
      ...v2,
      schemaVersion: 1,
      modules: v2.modules.map((module) => ({
        id: module.id,
        name: module.name,
        width: module.width,
        height: module.height,
        depth: module.depth,
        shelves: module.shelves,
        fronts: module.fronts,
      })),
    })
    const migrated = parseProject(raw)
    expect(migrated).toStrictEqual(v2)
    expect(JSON.parse(exportProject(migrated)).schemaVersion).toBe(3)
  })

  it('rejects broken divider references and duplicate divider IDs', () => {
    const project = createDefaultProject()
    project.modules[0]!.dividers.push({
      id: 'divider',
      left: 390,
      bottomBoundary: { type: 'module-bottom' },
      topBoundary: { type: 'shelf', shelfId: 'missing' },
    })
    expect(() => parseProject(exportProject(project))).toThrow(
      'invalid-structure',
    )
    project.modules[0]!.dividers[0]!.topBoundary = {
      type: 'shelf',
      shelfId: project.modules[0]!.shelves[0]!.id,
    }
    project.modules[0]!.dividers[0]!.id = project.modules[0]!.id
    expect(() => parseProject(exportProject(project))).toThrow(
      'invalid-structure',
    )
  })
  it('roundtrips only persisted data as readable JSON', () => {
    const project = createDefaultProject()
    const raw = exportProject({
      ...project,
      selection: 'ignored',
    } as typeof project)
    expect(raw).toContain('\n  "schemaVersion": 3,')
    expect(raw).not.toContain('selection')
    expect(parseProject(raw)).toEqual(project)
  })
  it.each([
    ['{', 'malformed-json'],
    ['null', 'invalid-structure'],
    ['{"schemaVersion":99}', 'unsupported-version'],
    ['{"schemaVersion":1}', 'invalid-structure'],
  ])('rejects %s', (raw, code) => {
    expect(() => parseProject(raw)).toThrow(code)
  })
  it('rejects malformed measurements and broken structural references', () => {
    const project = createDefaultProject()
    project.modules[0].width = 800.5
    expect(() => parseProject(JSON.stringify(project))).toThrow(
      'invalid-structure',
    )
    project.modules[0].width = 800
    project.modules[0].fronts[0].topBoundary = {
      type: 'shelf',
      shelfId: 'missing',
    }
    expect(() => parseProject(JSON.stringify(project))).toThrow(
      'invalid-structure',
    )
  })
  it('rejects duplicate object IDs', () => {
    const project = createDefaultProject()
    project.modules[0].shelves[0].id = project.id
    expect(() => parseProject(JSON.stringify(project))).toThrow(
      'invalid-structure',
    )
  })
  it('preserves geometrically invalid data for repair', () => {
    const project = createDefaultProject()
    project.modules[0].height = 10
    const imported = parseProject(exportProject(project))
    expect(imported).toEqual(project)
    expect(validateProject(imported).length).toBeGreaterThan(0)
  })
  it('creates safe filenames, including an empty-name fallback', () => {
    expect(projectFilename('My Wardrobe')).toBe('my-wardrobe.json')
    expect(projectFilename('../../')).toBe('cabinet-project.json')
  })
})
