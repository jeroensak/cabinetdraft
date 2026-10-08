import { describe, expect, it } from 'vitest'
import { createDefaultProject } from '../project/createDefaultProject'
import { deriveFrontGeometry } from './deriveFrontGeometry'
import { resolveFrontBoundary } from './resolveFrontBoundary'
import type { DoorFront, DrawerFront } from './types'

function fixture() {
  let id = 0
  const project = createDefaultProject(() => `id-${++id}`)
  const module = project.modules[0]!
  const door: DoorFront = {
    id: 'door',
    type: 'door',
    leaves: 2,
    bottomBoundary: { type: 'module-bottom' },
    topBoundary: { type: 'module-top' },
  }
  module.fronts = [door]
  return { module, settings: project.settings, door }
}

describe('deriveFrontGeometry', () => {
  it('derives exact default double leaves and all three horizontal gaps', () => {
    const { module, settings, door } = fixture()
    const result = deriveFrontGeometry(module, settings, door)
    expect(result).toStrictEqual({
      panels: [
        {
          moduleId: module.id,
          source: { type: 'door', frontId: 'door', leaf: 'left' },
          length: 2196,
          width: 397,
          thickness: 18,
          orientation: 'face',
          position: { x: 2, y: 2, z: -18 },
        },
        {
          moduleId: module.id,
          source: { type: 'door', frontId: 'door', leaf: 'right' },
          length: 2196,
          width: 397,
          thickness: 18,
          orientation: 'face',
          position: { x: 401, y: 2, z: -18 },
        },
      ],
      issues: [],
    })
    const [left, right] = result.panels
    expect(right!.position.x - (left!.position.x + left!.width)).toBe(2)
    expect(module.width - (right!.position.x + right!.width)).toBe(2)
  })

  it('derives a single full-height door with non-default dimensions, gap, and thickness', () => {
    const { module, settings, door } = fixture()
    Object.assign(module, { width: 503, height: 1200 })
    Object.assign(settings, { frontGap: 3, frontThickness: 22 })
    door.leaves = 1
    expect(deriveFrontGeometry(module, settings, door)).toStrictEqual({
      panels: [
        {
          moduleId: module.id,
          source: { type: 'door', frontId: 'door', leaf: 'single' },
          length: 1194,
          width: 497,
          thickness: 22,
          orientation: 'face',
          position: { x: 3, y: 3, z: -22 },
        },
      ],
      issues: [],
    })
  })

  it('resolves a partial door by shelf IDs, independent of array order', () => {
    const { module, settings, door } = fixture()
    module.shelves = [
      { id: 'upper', bottom: 1500 },
      { id: 'lower', bottom: 500 },
    ]
    door.leaves = 1
    door.bottomBoundary = { type: 'shelf', shelfId: 'lower' }
    door.topBoundary = { type: 'shelf', shelfId: 'upper' }
    const result = deriveFrontGeometry(module, settings, door)
    expect(result.issues).toStrictEqual([])
    expect(result.panels).toHaveLength(1)
    expect(result.panels[0]).toMatchObject({
      length: 998,
      width: 796,
      position: { y: 510 },
    })
  })

  it('derives adjacent drawer and door fronts with the configured gap over a shelf centre', () => {
    const { module, settings, door } = fixture()
    settings.corpusThickness = 20
    settings.frontGap = 4
    module.shelves = [{ id: 'divider', bottom: 500 }]
    const drawer: DrawerFront = {
      id: 'drawer',
      type: 'drawer',
      bottomBoundary: { type: 'module-bottom' },
      topBoundary: { type: 'shelf', shelfId: 'divider' },
    }
    door.leaves = 1
    door.bottomBoundary = { type: 'shelf', shelfId: 'divider' }
    const lower = deriveFrontGeometry(module, settings, drawer)
    const upper = deriveFrontGeometry(module, settings, door)
    expect(lower.issues).toStrictEqual([])
    expect(upper.issues).toStrictEqual([])
    expect(lower.panels[0]).toMatchObject({
      source: { type: 'drawer', frontId: 'drawer' },
      length: 504,
      width: 792,
      position: { y: 4 },
    })
    expect(upper.panels[0]).toMatchObject({
      length: 1684,
      width: 792,
      position: { y: 512 },
    })
    expect(
      upper.panels[0]!.position.y -
        (lower.panels[0]!.position.y + lower.panels[0]!.length),
    ).toBe(4)
  })

  it('uses the same geometry for a drawer and a single door between shelves', () => {
    const { module, settings, door } = fixture()
    module.shelves = [
      { id: 'low', bottom: 300 },
      { id: 'high', bottom: 900 },
    ]
    door.leaves = 1
    door.bottomBoundary = { type: 'shelf', shelfId: 'low' }
    door.topBoundary = { type: 'shelf', shelfId: 'high' }
    const drawer: DrawerFront = {
      id: 'drawer',
      type: 'drawer',
      bottomBoundary: door.bottomBoundary,
      topBoundary: door.topBoundary,
    }
    const result = deriveFrontGeometry(module, settings, drawer)
    expect(result.issues).toStrictEqual([])
    expect(result.panels[0]).toMatchObject({
      length: 598,
      width: 796,
      thickness: 18,
      position: { x: 2, y: 310, z: -18 },
    })
    const { source: drawerSource, ...drawerPanel } = result.panels[0]!
    const { source: doorSource, ...doorPanel } = deriveFrontGeometry(
      module,
      settings,
      door,
    ).panels[0]!
    expect(drawerSource.type).toBe('drawer')
    expect(doorSource.type).toBe('door')
    expect(drawerPanel).toStrictEqual(doorPanel)
  })

  it('keeps a spanning door unchanged when internal shelves are added or moved', () => {
    const { module, settings, door } = fixture()
    module.shelves = [
      { id: 'low', bottom: 300 },
      { id: 'high', bottom: 1800 },
    ]
    door.bottomBoundary = { type: 'shelf', shelfId: 'low' }
    door.topBoundary = { type: 'shelf', shelfId: 'high' }
    const before = structuredClone(deriveFrontGeometry(module, settings, door))
    module.shelves.push(
      { id: 'inside', bottom: 700 },
      { id: 'inside-2', bottom: 1200 },
    )
    expect(deriveFrontGeometry(module, settings, door)).toStrictEqual(before)
    module.shelves[2]!.bottom = 900
    expect(deriveFrontGeometry(module, settings, door)).toStrictEqual(before)
  })

  it('reports fractional double-leaf width without rounding or losing panels', () => {
    const { module, settings, door } = fixture()
    module.width = 801
    const result = deriveFrontGeometry(module, settings, door)
    expect(result.panels.map((panel) => panel.width)).toStrictEqual([
      397.5, 397.5,
    ])
    expect(result.panels[1]!.position.x).toBe(401.5)
    expect(result.issues).toStrictEqual([
      {
        code: 'fractional-front-dimension',
        moduleId: module.id,
        frontId: door.id,
        dimension: 'width',
        value: 397.5,
      },
    ])
  })

  it('reports fractional physical height at an internal shelf', () => {
    const { module, settings, door } = fixture()
    settings.corpusThickness = 19
    door.topBoundary = { type: 'shelf', shelfId: module.shelves[0]!.id }
    const result = deriveFrontGeometry(module, settings, door)
    expect(result.panels[0]!.length).toBe(1097.5)
    expect(result.issues).toStrictEqual([
      {
        code: 'fractional-front-dimension',
        moduleId: module.id,
        frontId: door.id,
        dimension: 'length',
        value: 1097.5,
      },
    ])
  })

  it('allows fractional placement when manufacturing dimensions remain integers', () => {
    const { module, settings, door } = fixture()
    settings.corpusThickness = 19
    module.shelves = [
      { id: 'low', bottom: 500 },
      { id: 'high', bottom: 1500 },
    ]
    door.bottomBoundary = { type: 'shelf', shelfId: 'low' }
    door.topBoundary = { type: 'shelf', shelfId: 'high' }
    const result = deriveFrontGeometry(module, settings, door)
    expect(result.panels[0]).toMatchObject({
      length: 998,
      position: { y: 510.5 },
    })
    expect(result.issues).toStrictEqual([])
  })

  it('reports missing boundaries without inventing replacement coordinates', () => {
    const { module, settings, door } = fixture()
    door.bottomBoundary = { type: 'shelf', shelfId: 'missing-low' }
    door.topBoundary = { type: 'shelf', shelfId: 'missing-high' }
    expect(
      resolveFrontBoundary(door.bottomBoundary, 'bottom', module, settings),
    ).toBeUndefined()
    expect(deriveFrontGeometry(module, settings, door)).toStrictEqual({
      panels: [],
      issues: [
        {
          code: 'missing-front-boundary',
          moduleId: module.id,
          frontId: door.id,
          edge: 'bottom',
          shelfId: 'missing-low',
        },
        {
          code: 'missing-front-boundary',
          moduleId: module.id,
          frontId: door.id,
          edge: 'top',
          shelfId: 'missing-high',
        },
      ],
    })
  })

  it('retains impossible dimensions and exposes geometry issues', () => {
    const { module, settings, door } = fixture()
    Object.assign(module, { width: 4, height: 3 })
    settings.frontThickness = 0
    const result = deriveFrontGeometry(module, settings, door)
    expect(result.panels[0]).toMatchObject({
      length: -1,
      width: -1,
      thickness: 0,
    })
    expect(result.issues).toStrictEqual([
      {
        code: 'invalid-front-dimension',
        moduleId: module.id,
        frontId: door.id,
        dimension: 'length',
        value: -1,
      },
      {
        code: 'invalid-front-dimension',
        moduleId: module.id,
        frontId: door.id,
        dimension: 'width',
        value: -1,
      },
      {
        code: 'invalid-front-dimension',
        moduleId: module.id,
        frontId: door.id,
        dimension: 'thickness',
        value: 0,
      },
    ])
  })

  it('does not mutate inputs or share mutable state with derived output', () => {
    const { module, settings, door } = fixture()
    const before = structuredClone({ module, settings, door })
    const result = deriveFrontGeometry(module, settings, door)
    result.panels[0]!.position.y = 100
    expect({ module, settings, door }).toStrictEqual(before)
  })

  it('keeps full-height fronts independent of carcass depth, back settings, and internal shelves', () => {
    const { module, settings, door } = fixture()
    const expected = deriveFrontGeometry(module, settings, door)
    module.depth = 450
    module.shelves = []
    Object.assign(settings, {
      backPanelEnabled: false,
      backPanelThickness: 10,
      corpusThickness: 22,
    })
    expect(deriveFrontGeometry(module, settings, door)).toStrictEqual(expected)
  })
})
