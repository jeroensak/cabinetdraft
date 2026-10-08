import { describe, expect, it } from 'vitest'
import { createDefaultProject } from '../project/createDefaultProject'
import { deriveCutList } from './deriveCutList'

function fixture() {
  let id = 0
  return createDefaultProject(() => `id-${++id}`)
}

describe('deriveCutList', () => {
  it('returns every default panel with exact manufacturing dimensions and IDs', () => {
    const project = fixture()
    const before = structuredClone(project)
    const common = { moduleId: 'id-2', moduleName: 'Cabinet 1', quantity: 1 }
    expect(deriveCutList(project)).toStrictEqual({
      available: true,
      items: [
        {
          ...common,
          id: 'C1-SIDE-L',
          part: 'side-left',
          length: 2200,
          width: 597,
          thickness: 18,
        },
        {
          ...common,
          id: 'C1-SIDE-R',
          part: 'side-right',
          length: 2200,
          width: 597,
          thickness: 18,
        },
        {
          ...common,
          id: 'C1-TOP',
          part: 'top',
          length: 764,
          width: 597,
          thickness: 18,
        },
        {
          ...common,
          id: 'C1-BOTTOM',
          part: 'bottom',
          length: 764,
          width: 597,
          thickness: 18,
        },
        {
          ...common,
          id: 'C1-SHELF-1',
          part: 'shelf',
          length: 764,
          width: 597,
          thickness: 18,
        },
        {
          ...common,
          id: 'C1-BACK',
          part: 'back',
          length: 2200,
          width: 800,
          thickness: 3,
        },
        {
          ...common,
          id: 'C1-DOOR-1-L',
          part: 'door',
          length: 2196,
          width: 397,
          thickness: 18,
        },
        {
          ...common,
          id: 'C1-DOOR-1-R',
          part: 'door',
          length: 2196,
          width: 397,
          thickness: 18,
        },
      ],
    })
    expect(project).toStrictEqual(before)
  })

  it('blocks all rows if any module is invalid and preserves the project', () => {
    const project = fixture()
    let id = 0
    const extra = createDefaultProject(() => `extra-${++id}`).modules[0]!
    extra.width = 801
    project.modules.push(extra)
    const before = structuredClone(project)
    const result = deriveCutList(project)
    expect(result.available).toBe(false)
    expect(result).not.toHaveProperty('items')
    if (result.available) throw new Error('Expected unavailable cut list')
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'fractional-front-dimension',
          moduleId: extra.id,
        }),
      ]),
    )
    expect(project).toStrictEqual(before)
  })

  it('keeps identical panels separate across modules and follows module order', () => {
    const project = fixture()
    let id = 0
    const second = createDefaultProject(() => `second-${++id}`).modules[0]!
    second.name = 'Second'
    project.modules.push(second)
    const result = deriveCutList(project)
    if (!result.available) throw new Error('Expected available cut list')
    expect(result.items).toHaveLength(16)
    expect(new Set(result.items.map((item) => item.id)).size).toBe(16)
    expect(result.items.every((item) => item.quantity === 1)).toBe(true)
    expect(result.items[8]).toMatchObject({
      id: 'C2-SIDE-L',
      moduleId: second.id,
      length: 2200,
      width: 597,
    })
    project.modules.reverse()
    const reordered = deriveCutList(project)
    if (!reordered.available) throw new Error('Expected available cut list')
    expect(reordered.items[0]).toMatchObject({
      id: 'C1-SIDE-L',
      moduleId: second.id,
      moduleName: 'Second',
    })
  })

  it('numbers sorted shelves, single doors and drawer fronts deterministically', () => {
    const project = fixture()
    const module = project.modules[0]!
    module.shelves = [
      { id: 'high', bottom: 1500 },
      { id: 'low', bottom: 500 },
    ]
    module.fronts = [
      {
        id: 'drawer',
        type: 'drawer',
        bottomBoundary: { type: 'module-bottom' },
        topBoundary: { type: 'shelf', shelfId: 'low' },
      },
      {
        id: 'door',
        type: 'door',
        leaves: 1,
        bottomBoundary: { type: 'shelf', shelfId: 'low' },
        topBoundary: { type: 'module-top' },
      },
    ]
    project.settings.backPanelEnabled = false
    const result = deriveCutList(project)
    if (!result.available) throw new Error('Expected available cut list')
    expect(result.items.map((item) => item.id)).toStrictEqual([
      'C1-SIDE-L',
      'C1-SIDE-R',
      'C1-TOP',
      'C1-BOTTOM',
      'C1-SHELF-1',
      'C1-SHELF-2',
      'C1-DRAWER-1',
      'C1-DOOR-1',
    ])
    expect(result.items[4]).toMatchObject({
      length: 764,
      width: 600,
      thickness: 18,
    })
    expect(result.items[6]).toMatchObject({
      part: 'drawer',
      length: 506,
      width: 796,
    })
    expect(result.items[7]).toMatchObject({
      part: 'door',
      length: 1688,
      width: 796,
    })
    module.shelves.reverse()
    expect(deriveCutList(project)).toStrictEqual(result)
  })

  it('returns an available empty list for a valid empty project', () => {
    const project = fixture()
    project.modules = []
    expect(deriveCutList(project)).toStrictEqual({ available: true, items: [] })
  })
})
