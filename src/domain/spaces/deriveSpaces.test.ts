import { describe, expect, it } from 'vitest'
import { createDefaultProject } from '../project/createDefaultProject'
import { deriveSpaces } from './deriveSpaces'
import { deriveCabinetGeometry } from '../cabinet/deriveCabinetGeometry'

function fixture() {
  let id = 0
  const project = createDefaultProject(() => `id-${++id}`)
  return { module: project.modules[0]!, settings: project.settings }
}

describe('deriveSpaces', () => {
  it('derives one free space between bottom and top panels for an empty module', () => {
    const { module, settings } = fixture()
    module.shelves = []
    expect(deriveSpaces(module, settings)).toStrictEqual([
      {
        bottomBoundary: { type: 'module-bottom' },
        topBoundary: { type: 'module-top' },
        bottom: 18,
        top: 2182,
        height: 2164,
      },
    ])
  })

  it('derives the two exact default spaces with stable shelf boundaries', () => {
    const { module, settings } = fixture()
    expect(deriveSpaces(module, settings)).toStrictEqual([
      {
        bottomBoundary: { type: 'module-bottom' },
        topBoundary: { type: 'shelf', shelfId: 'id-3' },
        bottom: 18,
        top: 1091,
        height: 1073,
      },
      {
        bottomBoundary: { type: 'shelf', shelfId: 'id-3' },
        topBoundary: { type: 'module-top' },
        bottom: 1109,
        top: 2182,
        height: 1073,
      },
    ])
  })

  it.each([false, true])(
    'derives multiple spaces, regardless of persisted shelf order (reversed: %s)',
    (reverse) => {
      const { module, settings } = fixture()
      module.shelves = [
        { id: 'low', bottom: 500 },
        { id: 'high', bottom: 1500 },
      ]
      if (reverse) module.shelves.reverse()
      const before = structuredClone({ module, settings })
      expect(deriveSpaces(module, settings)).toStrictEqual([
        {
          bottomBoundary: { type: 'module-bottom' },
          topBoundary: { type: 'shelf', shelfId: 'low' },
          bottom: 18,
          top: 500,
          height: 482,
        },
        {
          bottomBoundary: { type: 'shelf', shelfId: 'low' },
          topBoundary: { type: 'shelf', shelfId: 'high' },
          bottom: 518,
          top: 1500,
          height: 982,
        },
        {
          bottomBoundary: { type: 'shelf', shelfId: 'high' },
          topBoundary: { type: 'module-top' },
          bottom: 1518,
          top: 2182,
          height: 664,
        },
      ])
      expect({ module, settings }).toStrictEqual(before)
    },
  )

  it('uses the configured thickness and preserves absolute shelf positions after resizing', () => {
    const { module, settings } = fixture()
    settings.corpusThickness = 20
    module.height = 800
    const spaces = deriveSpaces(module, settings)
    expect(
      spaces.map(({ bottom, top, height }) => [bottom, top, height]),
    ).toStrictEqual([
      [20, 1091, 1071],
      [1111, 780, -331],
    ])
    expect(module.shelves[0]!.bottom).toBe(1091)
  })

  it.each([
    {
      name: 'coincident shelves',
      shelves: [
        { id: 'a', bottom: 500 },
        { id: 'b', bottom: 500 },
      ],
      coordinates: [
        [18, 500, 482],
        [518, 500, -18],
        [518, 2182, 1664],
      ],
    },
    {
      name: 'a shelf below the bottom panel',
      shelves: [{ id: 'a', bottom: -10 }],
      coordinates: [
        [18, -10, -28],
        [8, 2182, 2174],
      ],
    },
    {
      name: 'a shelf intersecting the top panel',
      shelves: [{ id: 'a', bottom: 2175 }],
      coordinates: [
        [18, 2175, 2157],
        [2193, 2182, -11],
      ],
    },
  ])(
    'retains all geometry and stable boundaries for $name',
    ({ shelves, coordinates }) => {
      const { module, settings } = fixture()
      module.shelves = shelves
      const before = structuredClone({ module, settings })
      const spaces = deriveSpaces(module, settings)
      const panels = deriveCabinetGeometry(module, settings).panels.filter(
        (panel) => panel.source.type === 'shelf',
      )

      expect(
        panels.map((panel) => ({
          source: panel.source,
          bottom: panel.position.y,
        })),
      ).toStrictEqual(
        shelves.map((shelf) => ({
          source: { type: 'shelf', shelfId: shelf.id },
          bottom: shelf.bottom,
        })),
      )
      expect(
        spaces.map(({ bottom, top, height }) => [bottom, top, height]),
      ).toStrictEqual(coordinates)
      expect(spaces.map((space) => space.bottomBoundary)).toStrictEqual([
        { type: 'module-bottom' },
        ...shelves.map((shelf) => ({ type: 'shelf', shelfId: shelf.id })),
      ])
      expect(spaces.map((space) => space.topBoundary)).toStrictEqual([
        ...shelves.map((shelf) => ({ type: 'shelf', shelfId: shelf.id })),
        { type: 'module-top' },
      ])
      expect({ module, settings }).toStrictEqual(before)
    },
  )

  it.each([
    'remove fronts',
    'replace door with drawer',
    'front gap',
    'front thickness',
  ] as const)(
    'keeps carcass geometry and spaces independent of changes to %s',
    (change) => {
      const { module, settings } = fixture()
      const geometry = structuredClone(deriveCabinetGeometry(module, settings))
      const spaces = structuredClone(deriveSpaces(module, settings))
      switch (change) {
        case 'remove fronts':
          module.fronts = []
          break
        case 'replace door with drawer':
          module.fronts = [
            {
              id: 'drawer',
              type: 'drawer',
              bottomBoundary: { type: 'module-bottom' },
              topBoundary: { type: 'shelf', shelfId: module.shelves[0]!.id },
            },
          ]
          break
        case 'front gap':
          settings.frontGap = 7
          break
        case 'front thickness':
          settings.frontThickness = 25
          break
      }
      expect(deriveCabinetGeometry(module, settings)).toStrictEqual(geometry)
      expect(deriveSpaces(module, settings)).toStrictEqual(spaces)
    },
  )

  it('preserves zero and negative spaces rather than filtering or repairing overlaps', () => {
    const { module, settings } = fixture()
    module.shelves = [
      { id: 'first', bottom: 18 },
      { id: 'second', bottom: 25 },
    ]
    expect(
      deriveSpaces(module, settings).map((space) => space.height),
    ).toStrictEqual([0, -11, 2139])
  })
})
