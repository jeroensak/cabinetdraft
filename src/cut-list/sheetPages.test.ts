import { jsPDF } from 'jspdf'
import { describe, expect, it, vi } from 'vitest'
import { deriveCutList } from '../domain/cutlist/deriveCutList'
import { deriveSheetLayout } from '../domain/cutlist/sheetLayout'
import { createDefaultProject } from '../domain/project/createDefaultProject'
import { addSheetPages } from './sheetPages'

const STOCK = { length: 2440, width: 1220, kerf: 4, priority: 'cuts' } as const

function layoutFor(stock: { length: number; width: number; kerf: number }) {
  const result = deriveCutList(createDefaultProject())
  if (!result.available) throw new Error('expected a cut list')
  return { items: result.items, layout: deriveSheetLayout(result.items, stock) }
}

function pages(
  stock:
    | typeof STOCK
    | { length: number; width: number; kerf: number; priority: 'cuts' },
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const text = vi.spyOn(doc, 'text')
  const rect = vi.spyOn(doc, 'rect')
  const line = vi.spyOn(doc, 'line')
  const circle = vi.spyOn(doc, 'circle')
  const dash = vi.spyOn(doc, 'setLineDashPattern')
  const { items, layout } = layoutFor(stock)
  const headers = addSheetPages(doc, layout, stock, 'mm')
  return { doc, text, rect, line, circle, dash, items, layout, headers }
}

describe('addSheetPages', () => {
  it('adds one page per sheet with a header for each', () => {
    const { doc, headers, layout } = pages(STOCK)
    const sheets = layout.groups.flatMap((group) => group.sheets)
    expect(sheets).toHaveLength(4)
    expect(headers).toHaveLength(4)
    expect(doc.getNumberOfPages()).toBe(5)
    expect(headers[0]!.title).toBe('Sheet 1 of 3, 18 mm thick')
    expect(headers[3]!.title).toBe('Sheet 1 of 1, 3 mm thick')
    expect(headers[0]!.summary).toContain('2440 × 1220 mm')
    expect(headers[0]!.summary).toContain('Saw kerf 4 mm')
    expect(headers[0]!.summary).toContain('Fewest cuts')
  })

  it('draws every part and cut, inside the page and to scale', () => {
    const { rect, line, circle, text, layout, items } = pages(STOCK)
    const sheets = layout.groups.flatMap((group) => group.sheets)
    const cuts = sheets.flatMap((sheet) => sheet.cuts).length
    const legends = 4 * sheets.length
    expect(rect).toHaveBeenCalledTimes(sheets.length + items.length + legends)
    expect(line).toHaveBeenCalledTimes(cuts)
    expect(circle).toHaveBeenCalledTimes(cuts)
    const scale = 267 / 2440
    expect(rect.mock.calls[0]!.slice(0, 4)).toStrictEqual([
      15,
      42,
      267,
      1220 * scale,
    ])
    const part = layout.groups[0]!.sheets[0]!.parts[0]!
    const [, , width, height] = rect.mock.calls[1]!
    expect(width).toBeCloseTo(part.spanX * scale, 6)
    expect(height).toBeCloseTo(part.spanY * scale, 6)
    for (const [, x, y] of text.mock.calls) {
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThanOrEqual(297)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(210)
    }
  })

  it('names every part once and numbers its cuts', () => {
    const { text, items, layout } = pages(STOCK)
    const written = text.mock.calls.map(([value]) => value)
    for (const item of items)
      expect(written.filter((value) => value === item.id)).toHaveLength(1)
    const firstCuts = layout.groups[0]!.sheets[0]!.cuts.length
    expect(written).toContain(String(firstCuts))
  })

  it('leaves dashes off once the cuts are drawn', () => {
    const { dash } = pages(STOCK)
    expect(dash.mock.lastCall).toStrictEqual([[], 0])
  })

  it('fits a square sheet by its height, and keeps it on the page', () => {
    const stock = {
      length: 2500,
      width: 2500,
      kerf: 4,
      priority: 'cuts' as const,
    }
    const { rect } = pages(stock)
    const [, , width, height] = rect.mock.calls[0]!
    expect(width).toBe(142)
    expect(height).toBe(142)
  })

  it('gives parts too large for the sheet a page of their own', () => {
    const stock = {
      length: 2000,
      width: 1220,
      kerf: 4,
      priority: 'cuts' as const,
    }
    const { headers, text } = pages(stock)
    expect(headers[0]!.title).toBe('Sheet layout')
    expect(String(text.mock.calls[0]![0])).toContain('C1-SIDE-L')
  })

  it('still gives that page when nothing fits at all', () => {
    const stock = {
      length: 100,
      width: 100,
      kerf: 4,
      priority: 'cuts' as const,
    }
    const { doc, headers } = pages(stock)
    expect(headers).toHaveLength(1)
    expect(doc.getNumberOfPages()).toBe(2)
  })
})
