// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  loadSheetPreference,
  saveSheetPreference,
  SHEET_SIZES,
  SHEET_STOCK_STORAGE_KEY,
} from './sheetStockPreference'

const preference = { length: 2000, width: 1000, kerf: 3, priority: 'sheets' }

describe('sheet preference', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('defaults to a standard board, a safe kerf and fewest cuts', () => {
    expect(loadSheetPreference('mm')).toStrictEqual({
      length: 2440,
      width: 1220,
      kerf: 4,
      priority: 'cuts',
    })
    expect(loadSheetPreference('inch')).toStrictEqual({
      length: 96 * 32,
      width: 48 * 32,
      kerf: 4,
      priority: 'cuts',
    })
  })

  it('restores a saw without a kerf', () => {
    saveSheetPreference('mm', { ...loadSheetPreference('mm'), kerf: 0 })
    expect(loadSheetPreference('mm').kerf).toBe(0)
  })

  it('keeps millimetres and inches apart', () => {
    saveSheetPreference('mm', { ...preference, priority: 'cuts' })
    saveSheetPreference('inch', {
      ...preference,
      length: 3200,
      priority: 'sheets',
    })
    expect(loadSheetPreference('mm').length).toBe(2000)
    expect(loadSheetPreference('inch').length).toBe(3200)
  })

  it.each([
    ['broken JSON', '{'],
    ['null', 'null'],
    ['a list', '[]'],
    ['a text size', JSON.stringify({ mm: { ...preference, length: '2000' } })],
    ['no size', JSON.stringify({ mm: { ...preference, length: 0 } })],
    ['a fraction', JSON.stringify({ mm: { ...preference, width: 1.5 } })],
    ['a negative kerf', JSON.stringify({ mm: { ...preference, kerf: -1 } })],
    [
      'an unknown priority',
      JSON.stringify({ mm: { ...preference, priority: 'x' } }),
    ],
  ])('falls back to the defaults for %s', (_, stored) => {
    localStorage.setItem(SHEET_STOCK_STORAGE_KEY, stored)
    expect(loadSheetPreference('mm').length).toBe(2440)
  })

  it('still works without storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(loadSheetPreference('mm').length).toBe(2440)
    expect(() =>
      saveSheetPreference('mm', { ...loadSheetPreference('mm'), kerf: 2 }),
    ).not.toThrow()
  })

  it('lists exact sizes, longest side first, and no size twice', () => {
    for (const sizes of Object.values(SHEET_SIZES)) {
      expect(new Set(sizes.map(String)).size).toBe(sizes.length)
      for (const [length, width] of sizes) {
        expect(Number.isInteger(length) && Number.isInteger(width)).toBe(true)
        expect(length).toBeGreaterThanOrEqual(width)
      }
    }
  })
})
