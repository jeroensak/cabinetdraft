import { describe, expect, it } from 'vitest'
import { deriveCutList } from '../cutlist/deriveCutList'
import { addDrawerDesign, addModule, updateDrawerDesign } from '../commands'
import { defaultDrawerDesign } from '../drawers/types'
import { exportProject, parseProject } from '../import-export/projectJson'
import { validateProject } from '../validation/validateProject'
import { convertToInches } from './convertToInches'
import { createDefaultProject } from './createDefaultProject'
import { inches } from './units'

const walk = (value: unknown): number[] =>
  typeof value === 'number'
    ? [value]
    : value && typeof value === 'object'
      ? Object.entries(value).flatMap(([key, item]) =>
          key.endsWith('Percent') || key === 'leaves' ? [] : walk(item),
        )
      : []

describe('inch designs', () => {
  const project = convertToInches(createDefaultProject())

  it('snaps sheets to 1/8" and other sizes to 1/16"', () => {
    expect(project.settings).toStrictEqual({
      unit: 'inch',
      corpusThickness: inches(3 / 4),
      backPanelEnabled: true,
      backPanelThickness: inches(1 / 8),
      frontThickness: inches(3 / 4),
      frontGap: inches(1 / 16),
    })
    expect(project.modules[0]).toMatchObject({
      width: inches(31.5),
      height: inches(86 + 5 / 8),
      depth: inches(23 + 5 / 8),
    })
  })

  it('stays valid, in whole units, and gives exact fractional cut sizes', () => {
    expect(validateProject(project)).toStrictEqual([])
    expect(walk(project).every(Number.isSafeInteger)).toBe(true)
    const result = deriveCutList(project)
    if (!result.available) throw new Error('expected a cut list')
    expect(result.items.every((item) => item.length % 1 === 0)).toBe(true)
  })

  it('keeps its unit through export and import, and is not converted twice', () => {
    expect(parseProject(exportProject(project))).toStrictEqual(project)
    expect(convertToInches(project)).toBe(project)
  })

  it('leaves millimetre projects without a unit in their file', () => {
    expect(
      JSON.parse(exportProject(createDefaultProject())).settings,
    ).not.toHaveProperty('unit')
  })

  it('rejects an unknown unit on import', () => {
    const raw = JSON.parse(exportProject(project))
    raw.settings.unit = 'cm'
    expect(() => parseProject(JSON.stringify(raw))).toThrow('invalid-structure')
  })

  it('adds cabinets in round inch sizes', () => {
    const added = addModule(project).modules.at(-1)!
    expect(added).toMatchObject({
      width: inches(32),
      height: inches(84),
      depth: inches(24),
    })
  })

  it('uses a default drawer in inches and the 1/8" side gap minimum', () => {
    const design = defaultDrawerDesign('inch')
    const next = addDrawerDesign(project, design)
    expect(validateProject(next)).toStrictEqual([])
    const stored = next.drawerDesigns[0]!
    expect(() =>
      updateDrawerDesign(next, stored.id, {
        ...design,
        sideClearance: inches(3 / 32),
      }),
    ).toThrow()
  })
})
