import { describe, expect, it } from 'vitest'
import { inches } from '../project/units'
import {
  divisionPositions,
  equalSpaceGuides,
  snapPosition,
  snapStep,
} from './snapPosition'

// A 2000 mm cabinet with 18 mm panels.
const span = { start: 18, size: 1964, thickness: 18 }

describe('snapPosition', () => {
  it('leaves equal spaces either side of a panel at 50%', () => {
    const middle = snapPosition(1000, span, 'mm', 20)
    expect(middle).toBe(991)
    expect(middle - span.start).toBe(973)
    expect(span.start + span.size - (middle + span.thickness)).toBe(973)
  })

  it('offers every multiple of 50%, 33.3%, 25% and 20%', () => {
    expect(
      equalSpaceGuides(span).map(({ position, percent }) => [
        position,
        percent,
      ]),
    ).toStrictEqual([
      [396, 20],
      [496, 25],
      [661, 33],
      [793, 40],
      [991, 50],
      [1189, 60],
      [1321, 67],
      [1487, 75],
      [1586, 80],
    ])
  })

  it('names the fewest spaces a shared position belongs to', () => {
    const middle = equalSpaceGuides(span).find((g) => g.percent === 50)
    expect(middle?.spaces).toBe(2)
    expect(divisionPositions(span, 3)).toStrictEqual([661, 1321])
  })

  it('makes the spaces of a division equal, panels included', () => {
    const [first, second] = [661, 1321]
    expect(first - span.start).toBe(643)
    expect(second - (first + span.thickness)).toBe(642)
    expect(span.start + span.size - (second + span.thickness)).toBe(643)
  })

  it('falls back to round steps away from an equal-space position', () => {
    expect(snapPosition(1234, span, 'mm', 5)).toBe(1230)
    expect(snapPosition(1236, span, 'mm', 5)).toBe(1240)
  })

  it('takes the nearest position when two are in reach', () => {
    expect(snapPosition(440, span, 'mm', 60)).toBe(396)
    expect(snapPosition(450, span, 'mm', 60)).toBe(496)
  })

  it('uses a quarter inch step in inch designs', () => {
    expect(snapStep('inch')).toBe(inches(1 / 4))
    expect(snapPosition(inches(10.1), span, 'inch', 0)).toBe(inches(10))
    expect(snapPosition(inches(10.2), span, 'inch', 0)).toBe(inches(10.25))
  })
})
