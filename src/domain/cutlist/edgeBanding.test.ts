import { describe, expect, it } from 'vitest'
import waveSideboard from '../../test-fixtures/wave-sideboard.json'
import { updateProjectSettings } from '../commands'
import { exportProject, parseProject } from '../import-export/projectJson'
import { convertToInches } from '../project/convertToInches'
import { createDefaultProject } from '../project/createDefaultProject'
import { inches } from '../project/units'
import type { Project } from '../project/types'
import { deriveCutList, type CutListItem } from './deriveCutList'
import {
  deriveEdgeBanding,
  deriveRowBanding,
  type BandingRow,
} from './edgeBanding'

const row = (
  part: CutListItem['part'],
  overrides: Partial<BandingRow> = {},
): BandingRow => ({ part, length: 700, width: 400, quantity: 1, ...overrides })

const items = (project: Project) => {
  const result = deriveCutList(project)
  if (!result.available) throw new Error('Fixture should be valid')
  return result.items
}

const on = { ...createDefaultProject().settings, edgeBanding: true }

describe('deriveRowBanding', () => {
  it.each([
    'side-left',
    'side-right',
    'top',
    'bottom',
    'shelf',
    'divider',
  ] as const)('bands only the front edge of a %s', (part) => {
    expect(deriveRowBanding(row(part))).toStrictEqual({
      edges: 'front',
      waveAllowance: false,
      length: 700,
    })
  })

  it.each(['door', 'drawer'] as const)(
    'bands all four edges of a %s',
    (part) => {
      expect(deriveRowBanding(row(part))).toStrictEqual({
        edges: 'all',
        waveAllowance: false,
        length: 2200,
      })
    },
  )

  it.each([
    'back',
    'drawer-side-left',
    'drawer-side-right',
    'drawer-box-front',
    'drawer-box-back',
    'drawer-bottom',
  ] as const)('leaves a %s unbanded', (part) => {
    expect(deriveRowBanding(row(part))).toStrictEqual({
      edges: 'none',
      waveAllowance: false,
      length: 0,
    })
  })

  it('follows Length for the front edge, even when Width is longer', () => {
    expect(
      deriveRowBanding(row('shelf', { length: 300, width: 560 })).length,
    ).toBe(300)
  })

  it('adds 25% to the whole of a wave top front, treated as straight', () => {
    expect(deriveRowBanding(row('drawer', { waveDip: 60 }))).toStrictEqual({
      edges: 'all',
      waveAllowance: true,
      length: 2750,
    })
  })

  it('keeps a half unit exact instead of rounding it', () => {
    // 2 × (200 + 597) = 1594, and 25% more is 1992.5.
    expect(
      deriveRowBanding(row('drawer', { length: 200, width: 597, waveDip: 30 }))
        .length,
    ).toBe(1992.5)
  })

  it('counts every part of a merged row', () => {
    expect(deriveRowBanding(row('side-left', { quantity: 4 })).length).toBe(
      2800,
    )
    expect(deriveRowBanding(row('door', { quantity: 3 })).length).toBe(6600)
    expect(
      deriveRowBanding(row('drawer', { quantity: 2, waveDip: 60 })).length,
    ).toBe(5500)
  })
})

describe('deriveEdgeBanding', () => {
  it('derives nothing unless the project turns it on', () => {
    const { settings } = createDefaultProject()
    expect(deriveEdgeBanding(settings, [row('door')])).toBeNull()
    expect(
      deriveEdgeBanding({ ...settings, edgeBanding: false }, [row('door')]),
    ).toBeNull()
  })

  it('totals merged and separate rows of the same parts alike', () => {
    const single = [row('door'), row('door'), row('door'), row('back')]
    const merged = [row('door', { quantity: 3 }), row('back')]
    expect(deriveEdgeBanding(on, single)?.totalLength).toBe(6600)
    expect(deriveEdgeBanding(on, merged)?.totalLength).toBe(6600)
  })

  it('totals a millimetre design from its real rows', () => {
    const project = createDefaultProject()
    const rows = items(project)
    const expected = rows.reduce(
      (total, { part, length, width }) =>
        total +
        (part === 'back'
          ? 0
          : part === 'door' || part === 'drawer'
            ? 2 * (length + width)
            : length),
      0,
    )
    expect(rows.some((item) => item.part === 'door')).toBe(true)
    expect(deriveEdgeBanding(on, rows)?.totalLength).toBe(expected)
  })

  it('covers dividers and wave fronts in a real design', () => {
    const rows = items(parseProject(JSON.stringify(waveSideboard)))
    const banding = deriveEdgeBanding(on, rows)!
    rows.forEach((item, index) => {
      if (item.part === 'divider')
        expect(banding.rows[index]!.length).toBe(item.length)
      if (item.part === 'drawer')
        expect(banding.rows[index]).toStrictEqual({
          edges: 'all',
          waveAllowance: item.waveDip !== undefined,
          length:
            2 *
            (item.length + item.width) *
            (item.waveDip !== undefined ? 1.25 : 1),
        })
    })
    expect(rows.some((item) => item.part === 'divider')).toBe(true)
    expect(rows.some((item) => item.waveDip !== undefined)).toBe(true)
  })

  it('works in stored 1/32 inch units for an inch design', () => {
    const project = convertToInches(createDefaultProject())
    const settings = { ...project.settings, edgeBanding: true }
    const rows = items(project)
    const banding = deriveEdgeBanding(settings, rows)!
    const sideIndex = rows.findIndex((item) => item.part === 'side-left')
    expect(banding.rows[sideIndex]!.length).toBe(rows[sideIndex]!.length)
    expect(banding.totalLength % 1).toBe(0)
    // A wave front of 5 1/32" × 20": the half unit is an exact 1/64".
    expect(
      deriveRowBanding(
        row('drawer', {
          length: inches(5) + 1,
          width: inches(20),
          waveDip: inches(1),
        }),
      ).length,
    ).toBe((2 * (161 + 640) * 5) / 4)
  })
})

describe('edge banding setting', () => {
  const project = createDefaultProject()

  it('changes no cut sizes', () => {
    const banded = updateProjectSettings(project, { edgeBanding: true })
    expect(items(banded)).toStrictEqual(items(project))
  })

  it('stays out of a project that never turned it on', () => {
    expect(project.settings).not.toHaveProperty('edgeBanding')
    expect(exportProject(project)).not.toContain('edgeBanding')
  })

  it('persists only the setting, and survives export and import', () => {
    const banded = updateProjectSettings(project, { edgeBanding: true })
    const json = exportProject(banded)
    expect(parseProject(json).settings.edgeBanding).toBe(true)
    expect(json.match(/banding/gi)).toHaveLength(1)
  })

  it('leaves a project as it was when turned off again', () => {
    const banded = updateProjectSettings(project, { edgeBanding: true })
    expect(
      exportProject(updateProjectSettings(banded, { edgeBanding: false })),
    ).toBe(exportProject(project))
  })

  it('refuses a malformed value on import', () => {
    const parsed = JSON.parse(exportProject(project)) as Project
    expect(() =>
      parseProject(
        JSON.stringify({
          ...parsed,
          settings: { ...parsed.settings, edgeBanding: 'yes' },
        }),
      ),
    ).toThrow('invalid-structure')
  })
})
