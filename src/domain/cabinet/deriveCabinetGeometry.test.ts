import { describe, expect, it } from 'vitest'
import { createDefaultProject } from '../project/createDefaultProject'
import { deriveCabinetGeometry } from './deriveCabinetGeometry'

function fixture() {
  let id = 0
  const project = createDefaultProject(() => `id-${++id}`)
  return { module: project.modules[0]!, settings: project.settings }
}

describe('deriveCabinetGeometry', () => {
  it('derives the exact default physical panels, positions, and manufacturing sizes', () => {
    const { module, settings } = fixture()
    const geometry = deriveCabinetGeometry(module, settings)
    expect(geometry).toStrictEqual({
      internalWidth: 764,
      carcassDepth: 597,
      interiorBottom: 18,
      interiorTop: 2182,
      panels: [
        {
          moduleId: 'id-2',
          source: { type: 'side-left' },
          length: 2200,
          width: 597,
          thickness: 18,
          orientation: 'side',
          position: { x: 0, y: 0, z: 0 },
        },
        {
          moduleId: 'id-2',
          source: { type: 'side-right' },
          length: 2200,
          width: 597,
          thickness: 18,
          orientation: 'side',
          position: { x: 782, y: 0, z: 0 },
        },
        {
          moduleId: 'id-2',
          source: { type: 'top' },
          length: 764,
          width: 597,
          thickness: 18,
          orientation: 'horizontal',
          position: { x: 18, y: 2182, z: 0 },
        },
        {
          moduleId: 'id-2',
          source: { type: 'bottom' },
          length: 764,
          width: 597,
          thickness: 18,
          orientation: 'horizontal',
          position: { x: 18, y: 0, z: 0 },
        },
        {
          moduleId: 'id-2',
          source: { type: 'shelf', shelfId: 'id-3' },
          length: 764,
          width: 597,
          thickness: 18,
          orientation: 'horizontal',
          position: { x: 18, y: 1091, z: 0 },
        },
        {
          moduleId: 'id-2',
          source: { type: 'back' },
          length: 2200,
          width: 800,
          thickness: 3,
          orientation: 'face',
          position: { x: 0, y: 0, z: 597 },
        },
      ],
    })
  })

  it('uses full depth and omits the back when disabled, ignoring its thickness', () => {
    const { module, settings } = fixture()
    settings.backPanelEnabled = false
    settings.backPanelThickness = 900
    const geometry = deriveCabinetGeometry(module, settings)
    expect(geometry.carcassDepth).toBe(600)
    expect(geometry.panels).toHaveLength(5)
    expect(geometry.panels.every((panel) => panel.width === 600)).toBe(true)
    expect(geometry.panels.some((panel) => panel.source.type === 'back')).toBe(
      false,
    )
  })

  it('uses supplied dimensions and global thickness, including for an empty carcass', () => {
    const { module, settings } = fixture()
    Object.assign(module, { width: 500, height: 1000, depth: 400, shelves: [] })
    Object.assign(settings, { corpusThickness: 20, backPanelThickness: 5 })
    const geometry = deriveCabinetGeometry(module, settings)
    expect(geometry.internalWidth).toBe(460)
    expect(geometry.carcassDepth).toBe(395)
    expect(
      geometry.panels.map(({ length, width, thickness }) => [
        length,
        width,
        thickness,
      ]),
    ).toStrictEqual([
      [1000, 395, 20],
      [1000, 395, 20],
      [460, 395, 20],
      [460, 395, 20],
      [1000, 500, 5],
    ])
  })

  it('sorts shelf panels by bottom without mutating persisted data or deriving fronts', () => {
    const { module, settings } = fixture()
    module.shelves = [
      { id: 'high', bottom: 1500 },
      { id: 'low', bottom: 500 },
    ]
    const before = structuredClone({ module, settings })
    const geometry = deriveCabinetGeometry(module, settings)
    expect(
      geometry.panels
        .filter((panel) => panel.source.type === 'shelf')
        .map((panel) => panel.source),
    ).toStrictEqual([
      { type: 'shelf', shelfId: 'low' },
      { type: 'shelf', shelfId: 'high' },
    ])
    expect(geometry.panels).toHaveLength(7)
    geometry.panels[0]!.position.x = 42
    expect({ module, settings }).toStrictEqual(before)
  })

  it('does not clamp or round impossible physical dimensions', () => {
    const { module, settings } = fixture()
    Object.assign(module, { width: 30, height: 10, depth: 2 })
    settings.corpusThickness = 18.5
    const geometry = deriveCabinetGeometry(module, settings)
    expect(geometry.internalWidth).toBe(-7)
    expect(geometry.carcassDepth).toBe(-1)
    expect(geometry.interiorTop).toBe(-8.5)
    expect(geometry.panels[0]!.thickness).toBe(18.5)
    expect(
      geometry.panels.find((panel) => panel.source.type === 'shelf')!.position
        .y,
    ).toBe(1091)
  })
})
