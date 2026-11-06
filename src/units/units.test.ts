import { describe, expect, it } from 'vitest'
import {
  formatBare,
  formatInches,
  formatMeasure,
  formatSize,
  parseInches,
} from './index'
import { inches } from '../domain/project/units'

describe('inch notation', () => {
  it.each([
    [inches(1 / 16), '1/16'],
    [inches(1 / 8), '1/8'],
    [inches(3 / 4), '3/4'],
    [inches(31.5), '31 1/2'],
    [inches(32), '32'],
    [inches(23 + 5 / 8), '23 5/8'],
    [inches(1 / 32), '1/32'],
    [0, '0'],
  ])('writes %i units as %s and reads it back exactly', (units, text) => {
    expect(formatInches(units)).toBe(text)
    expect(parseInches(text)).toBe(units)
  })

  it('shows half a unit in 64ths, such as half a 3/32 wall', () => {
    expect(formatInches(1.5)).toBe('3/64')
  })

  it.each([
    ['31 1/2', 1008],
    ['31-1/2', 1008],
    ['31 - 1/2', 1008],
    ['31 1 / 2', 1008],
    ['31 1/2"', 1008],
    ['31 1/2″', 1008],
    ['31 1/2 in', 1008],
    ['31.5', 1008],
    ['31,5', 1008],
    ['.75', 24],
    ['3/4', 24],
    ['32', 1024],
  ])('accepts %s', (text, units) => {
    expect(parseInches(text)).toBe(units)
  })

  it.each(['', 'abc', '1/64', '1/3', '0.1', '31 1/', '1/0', '-1', '1 2'])(
    'refuses %s instead of rounding it',
    (text) => {
      expect(parseInches(text)).toBeNull()
    },
  )

  it.each([
    [inches(47 + 7 / 8), '47 7/8"'],
    [inches(48), "4'"],
    [inches(80), '6\' 8"'],
    [inches(80.5), '6\' 8 1/2"'],
    [inches(96), "8'"],
    [inches(96 + 1 / 32), '8\' 1/32"'],
    [-inches(80), '-6\' 8"'],
  ])('shows large sizes in feet and inches: %i units as %s', (units, text) => {
    expect(formatMeasure(units, 'inch')).toBe(text)
  })

  it('keeps plain inches where sizes are typed or cut from', () => {
    expect(formatInches(inches(80))).toBe('80')
    expect(formatBare(inches(80), 'inch')).toBe('80')
  })

  it('writes sizes with their unit', () => {
    expect(formatMeasure(800, 'mm')).toBe('800 mm')
    expect(formatMeasure(inches(31.5), 'inch')).toBe('31 1/2"')
    expect(formatSize([754, 537], 'mm')).toBe('754 × 537 mm')
    expect(formatSize([inches(31.5), inches(20)], 'inch')).toBe('31 1/2" × 20"')
    expect(formatBare(inches(31.5), 'inch')).toBe('31 1/2')
    expect(formatBare(754, 'mm')).toBe('754')
  })
})
