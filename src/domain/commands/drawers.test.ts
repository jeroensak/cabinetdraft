import { describe, expect, it } from 'vitest'
import {
  addDrawerDesign,
  applyDrawerDesign,
  deleteDrawerDesign,
  drawerDesignUsage,
  updateDrawerDesign,
} from './drawers'
import { removeFront } from './fronts'
import { addShelfToSpace } from './shelves'
import { addBoxlessFront, fixture, freeze, ids, rejects } from './testHelpers'
import { defaultDrawerDesign } from '../drawers/types'
import { deriveDrawerGeometry } from '../drawers/deriveDrawerGeometry'
import { deriveCutList } from '../cutlist/deriveCutList'
import { validateProject } from '../validation/validateProject'
import type { Project } from '../project/types'

const lower = (project: Project) => ({
  bottomBoundary: { type: 'module-bottom' as const },
  topBoundary: {
    type: 'shelf' as const,
    shelfId: project.modules[0]!.shelves[0]!.id,
  },
})
const upper = (project: Project) => ({
  bottomBoundary: {
    type: 'shelf' as const,
    shelfId: project.modules[0]!.shelves[0]!.id,
  },
  topBoundary: { type: 'module-top' as const },
})

/** Default cabinet without fronts plus one design `design-1`. */
function withDesign() {
  const project = fixture()
  project.modules[0]!.fronts = []
  return addDrawerDesign(project, defaultDrawerDesign(), ids('design'))
}

describe('drawer design commands', () => {
  it('appends a reusable design without mutating the input', () => {
    const project = fixture()
    const next = addDrawerDesign(
      freeze(project),
      freeze(defaultDrawerDesign()),
      ids('design'),
    )
    expect(project.drawerDesigns).toStrictEqual([])
    expect(next.drawerDesigns).toStrictEqual([
      { id: 'design-1', ...defaultDrawerDesign() },
    ])
    expect(validateProject(next)).toStrictEqual([])
  })

  it('rejects designs with less than 3 mm side clearance, blank names or a height outside 1–100%', () => {
    const project = fixture()
    for (const patch of [
      { sideClearance: 2 },
      { name: '  ' },
      { heightPercent: 0 },
      { heightPercent: 101 },
      { frontHeightPercent: 0 },
      { frontHeightPercent: 101 },
      { depth: 30 },
    ])
      rejects(
        project,
        () => addDrawerDesign(project, { ...defaultDrawerDesign(), ...patch }),
        'invalid-drawer-design',
      )
    rejects(
      project,
      () =>
        addDrawerDesign(project, { ...defaultDrawerDesign(), depth: 450.5 }),
      'invalid-integer',
    )
  })

  it('applies one design to several spaces as independent drawer fronts', () => {
    const project = withDesign()
    const moduleId = project.modules[0]!.id
    const next = applyDrawerDesign(
      freeze(project),
      'design-1',
      [
        { moduleId, range: lower(project) },
        { moduleId, range: upper(project) },
      ],
      ids('front'),
    )
    expect(next.modules[0]!.fronts).toStrictEqual([
      {
        id: 'front-1',
        type: 'drawer',
        ...lower(project),
        drawerDesignId: 'design-1',
      },
      {
        id: 'front-2',
        type: 'drawer',
        ...upper(project),
        drawerDesignId: 'design-1',
      },
    ])
    expect(drawerDesignUsage(next, 'design-1')).toBe(2)
    expect(validateProject(next)).toStrictEqual([])
  })

  it('upgrades an existing drawer front in place, keeping its ID', () => {
    const base = withDesign()
    const moduleId = base.modules[0]!.id
    const project = addBoxlessFront(base, moduleId, lower(base), ids('front'))
    const next = applyDrawerDesign(project, 'design-1', [
      { moduleId, range: lower(project) },
    ])
    expect(next.modules[0]!.fronts).toStrictEqual([
      {
        id: 'front-1',
        type: 'drawer',
        ...lower(project),
        drawerDesignId: 'design-1',
      },
    ])
  })

  it('never replaces a door and rejects drawers that do not fit, atomically', () => {
    const project = fixture()
    project.drawerDesigns.push({ id: 'design-1', ...defaultDrawerDesign() })
    const moduleId = project.modules[0]!.id
    rejects(
      project,
      () =>
        applyDrawerDesign(project, 'design-1', [
          { moduleId, range: lower(project) },
        ]),
      'space-occupied',
    )
    const empty = withDesign()
    const deep = updateDrawerDesign(empty, 'design-1', {
      ...defaultDrawerDesign(),
      depth: 595,
    })
    rejects(
      deep,
      () =>
        applyDrawerDesign(deep, 'design-1', [
          { moduleId, range: lower(deep) },
          { moduleId, range: upper(deep) },
        ]),
      'drawer-does-not-fit',
    )
    rejects(
      empty,
      () =>
        applyDrawerDesign(empty, 'missing', [
          { moduleId, range: lower(empty) },
        ]),
      'drawer-design-not-found',
    )
  })

  it('updates every linked drawer, may leave invalid fit for repair, and blocks deleting used designs', () => {
    const project = withDesign()
    const moduleId = project.modules[0]!.id
    const applied = applyDrawerDesign(project, 'design-1', [
      { moduleId, range: lower(project) },
    ])
    const tooDeep = updateDrawerDesign(applied, 'design-1', {
      ...defaultDrawerDesign(),
      depth: 600,
    })
    expect(validateProject(tooDeep).map((issue) => issue.code)).toStrictEqual([
      'drawer-does-not-fit',
    ])
    rejects(
      applied,
      () => deleteDrawerDesign(applied, 'design-1'),
      'drawer-design-in-use',
    )
    const frontId = applied.modules[0]!.fronts[0]!.id
    const detached = removeFront(applied, moduleId, frontId)
    expect(
      deleteDrawerDesign(detached, 'design-1').drawerDesigns,
    ).toStrictEqual([])
  })

  it('keeps the box design on both drawers when a shelf splits the space', () => {
    const project = withDesign()
    const moduleId = project.modules[0]!.id
    const applied = applyDrawerDesign(project, 'design-1', [
      { moduleId, range: lower(project) },
    ])
    const split = addShelfToSpace(
      applied,
      moduleId,
      lower(applied),
      ids('split'),
    )
    const drawers = split.modules[0]!.fronts
    expect(drawers).toHaveLength(2)
    expect(drawers.every((front) => front.type === 'drawer')).toBe(true)
    expect(
      drawers.map((front) =>
        front.type === 'drawer' ? front.drawerDesignId : undefined,
      ),
    ).toStrictEqual(['design-1', 'design-1'])
  })
})

describe('drawer geometry and cut list', () => {
  it('fits the box to the opening width and defaults to half the space height', () => {
    const project = withDesign()
    const module = project.modules[0]!
    const geometry = deriveDrawerGeometry(
      module,
      project.settings,
      { id: 'drawer', type: 'drawer', ...lower(project) },
      project.drawerDesigns[0]!,
    )
    // Opening: 764 mm internal width, 18..1091 mm = 1073 mm high.
    expect(geometry).toMatchObject({
      openingWidth: 764,
      openingHeight: 1073,
      width: 754,
      height: 537,
      depth: 450,
      carcassDepth: 597,
      gaps: { side: 5, bottom: 14, top: 7, rear: 3 },
      issues: [],
    })
    expect(
      geometry.boxPanels.map(
        ({ source, length, width, thickness, position }) => [
          source.type,
          length,
          width,
          thickness,
          position,
        ],
      ),
    ).toStrictEqual([
      ['drawer-side-left', 537, 450, 18, { x: 23, y: 32, z: 0 }],
      ['drawer-side-right', 537, 450, 18, { x: 759, y: 32, z: 0 }],
      ['drawer-box-front', 537, 718, 18, { x: 41, y: 32, z: 0 }],
      ['drawer-box-back', 537, 718, 18, { x: 41, y: 32, z: 432 }],
      ['drawer-bottom', 736, 432, 6, { x: 32, y: 45, z: 9 }],
    ])
    expect(geometry.frontPanels).toHaveLength(1)
  })

  it('grooves all four walls half their thickness to hold the bottom', () => {
    const project = withDesign()
    const front = { id: 'drawer', type: 'drawer' as const, ...lower(project) }
    const geometry = deriveDrawerGeometry(
      project.modules[0]!,
      project.settings,
      front,
      { ...project.drawerDesigns[0]!, wallThickness: 15 },
    )
    const bottom = geometry.boxPanels.at(-1)!
    expect(geometry.boxPanels.slice(0, 4).map((p) => p.groove)).toStrictEqual(
      Array(4).fill({ depth: 7.5, width: 6, fromEdge: 13 }),
    )
    expect(bottom).not.toHaveProperty('groove')
    expect([bottom.length, bottom.width]).toStrictEqual([739, 435])
    // Each edge of the plate reaches exactly the bottom of the groove.
    const left = geometry.boxPanels[0]!
    expect(bottom.position.x).toBe(left.position.x + 15 / 2)
    expect(geometry.issues).toStrictEqual([])
  })

  it('rounds a percentage of the space height to whole millimetres', () => {
    const project = withDesign()
    const front = { id: 'drawer', type: 'drawer' as const, ...lower(project) }
    const geometry = deriveDrawerGeometry(
      project.modules[0]!,
      project.settings,
      front,
      { ...project.drawerDesigns[0]!, heightPercent: 25 },
    )
    expect(geometry.height).toBe(268)
    expect(geometry.issues).toStrictEqual([])
  })

  it('moves the box behind an inset front and rejects a box that no longer fits', () => {
    const project = withDesign()
    const front = { id: 'drawer', type: 'drawer' as const, ...lower(project) }
    const module = project.modules[0]!
    const design = project.drawerDesigns[0]!
    const inset = deriveDrawerGeometry(module, project.settings, front, {
      ...design,
      frontMount: 'inset',
    })
    expect(inset.boxPanels.map((panel) => panel.position.z)).toStrictEqual([
      18, 18, 18, 450, 27,
    ])
    expect(inset.issues).toStrictEqual([])
    const tooDeep = deriveDrawerGeometry(module, project.settings, front, {
      ...design,
      depth: module.depth,
      frontMount: 'inset',
    })
    expect(tooDeep.issues[0]!.message).toContain('inset front')
  })

  it('applies the design front options to the cut list', () => {
    const designed = withDesign()
    const project = applyDrawerDesign(designed, 'design-1', [
      { moduleId: designed.modules[0]!.id, range: lower(designed) },
    ])
    project.drawerDesigns[0]!.frontStyle = 'wave'
    project.drawerDesigns[0]!.frontHeightPercent = 50
    const result = deriveCutList(project)
    expect(result.available).toBe(true)
    if (!result.available) return
    const fronts = result.items.filter((item) => item.part === 'drawer')
    expect(fronts.length).toBeGreaterThan(0)
    const walls = result.items.filter((item) => item.groove)
    expect(walls.map((item) => item.part)).toStrictEqual([
      'drawer-side-left',
      'drawer-side-right',
      'drawer-box-front',
      'drawer-box-back',
    ])
    for (const item of fronts)
      expect(item.waveDip).toBe(Math.round(item.length * 0.15))
  })

  it('reports vertical overflow and a bottom taller than the walls', () => {
    const project = withDesign()
    const front = { id: 'drawer', type: 'drawer' as const, ...lower(project) }
    const design = { ...project.drawerDesigns[0]!, heightPercent: 100 }
    const geometry = deriveDrawerGeometry(
      project.modules[0]!,
      project.settings,
      front,
      design,
    )
    expect(geometry.height).toBe(1073)
    expect(geometry.issues.map((issue) => issue.code)).toStrictEqual([
      'drawer-does-not-fit',
    ])
    const short = deriveDrawerGeometry(
      project.modules[0]!,
      project.settings,
      front,
      { ...project.drawerDesigns[0]!, heightPercent: 1 },
    )
    expect(short.issues.map((issue) => issue.message)).toContain(
      'The recessed bottom leaves no usable height in this drawer.',
    )
  })

  it('lists five box panels plus the front for each linked drawer', () => {
    const project = withDesign()
    const moduleId = project.modules[0]!.id
    const applied = applyDrawerDesign(project, 'design-1', [
      { moduleId, range: lower(project) },
    ])
    const result = deriveCutList(applied)
    if (!result.available) throw new Error('expected a cut list')
    expect(
      result.items
        .filter((item) => item.part.startsWith('drawer'))
        .map(({ id, length, width, thickness }) => [
          id,
          length,
          width,
          thickness,
        ]),
    ).toStrictEqual([
      ['C1-DRAWER-1-SIDE-L', 537, 450, 18],
      ['C1-DRAWER-1-SIDE-R', 537, 450, 18],
      ['C1-DRAWER-1-BOX-FRONT', 537, 718, 18],
      ['C1-DRAWER-1-BOX-BACK', 537, 718, 18],
      ['C1-DRAWER-1-BOTTOM', 736, 432, 6],
      ['C1-DRAWER-1', 1097, 796, 18],
    ])
  })

  it('flags drawer fronts that reference a missing design as structural', () => {
    const project = withDesign()
    project.modules[0]!.fronts.push({
      id: 'drawer',
      type: 'drawer',
      ...lower(project),
      drawerDesignId: 'missing',
    })
    expect(validateProject(project).map((issue) => issue.code)).toStrictEqual([
      'missing-drawer-design',
    ])
  })
})
