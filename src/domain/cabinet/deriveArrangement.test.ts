import { describe, expect, it } from 'vitest'
import { createDefaultProject } from '../project/createDefaultProject'
import { deriveArrangement } from './deriveArrangement'

describe('deriveArrangement', () => {
  it('places differing modules adjacent in array order with a common front and bottom', () => {
    const project = createDefaultProject()
    const template = project.modules[0]
    project.modules = [
      { ...template, id: 'a', width: 600, height: 1800, depth: 400 },
      { ...template, id: 'b', width: 800, height: 2200, depth: 600 },
      { ...template, id: 'c', width: 500, height: 1600, depth: 500 },
    ]
    const before = JSON.stringify(project)
    const result = deriveArrangement(project)
    expect(result.modules.map((item) => item.origin)).toEqual([
      { x: 0, y: 0, z: 0 },
      { x: 600, y: 0, z: 0 },
      { x: 1400, y: 0, z: 0 },
    ])
    expect(result.totalWidth).toBe(1900)
    expect(result.maximumHeight).toBe(2200)
    expect(result.modules.map((item) => item.geometry.carcassDepth)).toEqual([
      397, 597, 497,
    ])
    expect(JSON.stringify(project)).toBe(before)
    project.modules.reverse()
    expect(
      deriveArrangement(project).modules.map((item) => [
        item.module.id,
        item.origin.x,
      ]),
    ).toEqual([
      ['c', 0],
      ['b', 500],
      ['a', 1300],
    ])
  })
  it('supports an empty project', () => {
    expect(
      deriveArrangement({ ...createDefaultProject(), modules: [] }),
    ).toEqual({ modules: [], totalWidth: 0, maximumHeight: 0 })
  })
})
