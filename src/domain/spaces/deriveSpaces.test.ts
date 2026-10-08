import { describe, expect, it } from 'vitest'
import { createDefaultProject } from '../project/createDefaultProject'
import { deriveSpaces } from './deriveSpaces'

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
