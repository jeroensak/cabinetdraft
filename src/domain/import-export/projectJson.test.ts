import { describe, expect, it } from 'vitest'
import { createDefaultProject } from '../project/createDefaultProject'
import { exportProject, parseProject, projectFilename } from './projectJson'
import { validateProject } from '../validation/validateProject'
import { defaultDrawerDesign } from '../drawers/types'

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
    expect(JSON.parse(exportProject(migrated)).schemaVersion).toBe(6)
  })

  it('migrates V3 projects with an empty drawer library and keeps drawer designs on roundtrip', () => {
    const project = createDefaultProject()
    const { drawerDesigns: _omitted, ...v3 } = { ...project, schemaVersion: 3 }
    expect(_omitted).toStrictEqual([])
    expect(parseProject(JSON.stringify(v3))).toStrictEqual(project)
    const withDesign = {
      ...project,
      drawerDesigns: [{ id: 'design-1', ...defaultDrawerDesign() }],
    }
    expect(parseProject(exportProject(withDesign))).toStrictEqual(withDesign)
    expect(() =>
      parseProject(
        exportProject({
          ...withDesign,
          drawerDesigns: [{ ...withDesign.drawerDesigns[0]!, id: project.id }],
        }),
      ),
    ).toThrow('invalid-structure')
  })

  it('migrates V4 drawer heights to percentages of the opening', () => {
    const project = createDefaultProject()
    const module = project.modules[0]!
    const {
      heightPercent: _omitted,
      frontStyle: _style,
      frontMount: _mount,
      frontHeightPercent: _front,
      ...v4Design
    } = defaultDrawerDesign()
    expect([_omitted, _style, _mount, _front]).toStrictEqual([
      50,
      'full',
      'overlay',
      100,
    ])
    const v4 = {
      ...project,
      schemaVersion: 4,
      drawerDesigns: [
        { ...v4Design, id: 'automatic', height: null },
        { ...v4Design, id: 'fixed', height: 216 },
        { ...v4Design, id: 'unused', height: 216 },
      ],
      modules: [
        {
          ...module,
          fronts: [
            {
              id: 'drawer',
              type: 'drawer',
              bottomBoundary: { type: 'module-bottom' },
              topBoundary: { type: 'shelf', shelfId: module.shelves[0]!.id },
              drawerDesignId: 'fixed',
            },
          ],
        },
      ],
    }
    const migrated = parseProject(JSON.stringify(v4))
    expect(migrated.schemaVersion).toBe(6)
    expect(
      migrated.drawerDesigns.map((design) => design.heightPercent),
    ).toStrictEqual([50, 20, 50])
    expect(migrated.drawerDesigns[1]).not.toHaveProperty('height')
  })

  it('rejects drawer designs with a missing height or an unknown front option', () => {
    const project = createDefaultProject()
    const design = { id: 'design-1', ...defaultDrawerDesign() }
    for (const broken of [
      { ...design, heightPercent: undefined },
      { ...design, frontHeightPercent: undefined },
      { ...design, frontStyle: 'zigzag' },
      { ...design, frontMount: 'floating' },
    ])
      expect(() =>
        parseProject(JSON.stringify({ ...project, drawerDesigns: [broken] })),
      ).toThrow('invalid-structure')
  })

  it('gives V5 designs a full overlay front at full height', () => {
    const {
      frontStyle: _style,
      frontMount: _mount,
      frontHeightPercent: _front,
      ...v5Design
    } = defaultDrawerDesign()
    expect([_style, _mount, _front]).toStrictEqual(['full', 'overlay', 100])
    const project = createDefaultProject()
    const migrated = parseProject(
      JSON.stringify({
        ...project,
        schemaVersion: 5,
        drawerDesigns: [{ ...v5Design, id: 'design-1' }],
      }),
    )
    expect(migrated.drawerDesigns).toStrictEqual([
      { id: 'design-1', ...defaultDrawerDesign() },
    ])
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
    expect(raw).toContain('\n  "schemaVersion": 6,')
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
