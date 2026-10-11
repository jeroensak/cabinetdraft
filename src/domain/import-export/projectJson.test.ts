import { describe, expect, it } from 'vitest'
import { createDefaultProject } from '../project/createDefaultProject'
import { exportProject, parseProject, projectFilename } from './projectJson'
import { validateProject } from '../validation/validateProject'

describe('project JSON boundary', () => {
  it('roundtrips only persisted data as readable JSON', () => {
    const project = createDefaultProject()
    const raw = exportProject({
      ...project,
      selection: 'ignored',
    } as typeof project)
    expect(raw).toContain('\n  "schemaVersion": 1,')
    expect(raw).not.toContain('selection')
    expect(parseProject(raw)).toEqual(project)
  })
  it.each([
    ['{', 'malformed-json'],
    ['null', 'invalid-structure'],
    ['{"schemaVersion":2}', 'unsupported-version'],
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
