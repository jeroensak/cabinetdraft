import { describe, expect, it } from 'vitest'
import { createDefaultProject } from '../project/createDefaultProject'
import template2 from '../../design-templates/template-2.json'
import type { Project } from '../project/types'
import { deriveCutList, type CutListItem } from './deriveCutList'
import {
  deriveSheetLayout,
  type LaidOutSheet,
  type SheetLayout,
  type SheetCut,
  type SheetPart,
  type SheetPriority,
  type SheetStock,
} from './sheetLayout'

const STOCK: SheetStock = { length: 2440, width: 1220, kerf: 4 }

function parts(
  sizes: [length: number, width: number, thickness?: number][],
): CutListItem[] {
  return sizes.map(([length, width, thickness = 18], index) => ({
    id: `P${index + 1}`,
    moduleId: 'm',
    moduleName: 'Cabinet',
    part: 'shelf',
    quantity: 1,
    length,
    width,
    thickness,
  }))
}

interface Piece {
  x: number
  y: number
  w: number
  h: number
}

/** Saws the sheet independently of the layout code: every cut must run right
 * across one whole piece, and all the parts must come out at their exact size. */
function sawSheet({ parts, cuts }: LaidOutSheet, stock: SheetStock) {
  let pieces: Piece[] = [{ x: 0, y: 0, w: stock.length, h: stock.width }]
  const inPiece = (cut: SheetCut, piece: Piece) =>
    cut.axis === 'x'
      ? cut.from === piece.y &&
        cut.to === piece.y + piece.h &&
        cut.position > piece.x &&
        cut.position < piece.x + piece.w
      : cut.from === piece.x &&
        cut.to === piece.x + piece.w &&
        cut.position > piece.y &&
        cut.position < piece.y + piece.h
  for (const cut of cuts) {
    const piece = pieces.find((candidate) => inPiece(cut, candidate))
    if (!piece) throw new Error(`Cut ${cut.order} crosses no whole piece`)
    const { kerf } = stock
    const near =
      cut.axis === 'x'
        ? { ...piece, w: cut.position - piece.x }
        : { ...piece, h: cut.position - piece.y }
    const far =
      cut.axis === 'x'
        ? {
            ...piece,
            x: cut.position + kerf,
            w: piece.x + piece.w - cut.position - kerf,
          }
        : {
            ...piece,
            y: cut.position + kerf,
            h: piece.y + piece.h - cut.position - kerf,
          }
    pieces = [...pieces.filter((other) => other !== piece), near, far]
  }
  const matches = (part: SheetPart) =>
    pieces.some(
      ({ x, y, w, h }) =>
        x === part.x && y === part.y && w === part.spanX && h === part.spanY,
    )
  expect(parts.filter((part) => !matches(part))).toStrictEqual([])
  parts.forEach((a, index) => {
    for (const b of parts.slice(index + 1)) {
      const apartX = Math.max(a.x, b.x) - Math.min(a.x + a.spanX, b.x + b.spanX)
      const apartY = Math.max(a.y, b.y) - Math.min(a.y + a.spanY, b.y + b.spanY)
      expect(Math.max(apartX, apartY)).toBeGreaterThanOrEqual(stock.kerf)
    }
  })
}

/** Everything that must hold for any parts on any sheet with any saw. */
function expectSoundLayout(
  items: CutListItem[],
  stock: SheetStock,
  layout: SheetLayout,
) {
  const placed = layout.groups.flatMap((group) =>
    group.sheets.flatMap((sheet) => sheet.parts),
  )
  expect(
    [
      ...placed.map((part) => part.id),
      ...layout.tooLarge.map((item) => item.id),
    ]
      .sort()
      .join(),
  ).toBe(
    items
      .map((item) => item.id)
      .sort()
      .join(),
  )
  const canFit = ({ length, width }: CutListItem) =>
    (length <= stock.length && width <= stock.width) ||
    (width <= stock.length && length <= stock.width)
  expect(layout.tooLarge.every((item) => !canFit(item))).toBe(true)
  for (const group of layout.groups) {
    const sheetArea = stock.length * stock.width
    const used = group.sheets
      .flatMap((sheet) => sheet.parts)
      .reduce((sum, part) => sum + part.spanX * part.spanY, 0)
    expect(group.sheets.length).toBeGreaterThanOrEqual(
      Math.ceil(used / sheetArea),
    )
    expect(group.waste).toBeCloseTo(
      1 - used / (group.sheets.length * sheetArea),
      9,
    )
    expect(group.cuts).toBe(
      group.sheets.reduce((sum, sheet) => sum + sheet.cuts.length, 0),
    )
    for (const sheet of group.sheets) {
      expect(sheet.parts.length).toBeGreaterThan(0)
      expect(sheet.cuts.map((cut) => cut.order)).toStrictEqual(
        sheet.cuts.map((_, index) => index + 1),
      )
      sawSheet(sheet, stock)
      for (const part of sheet.parts) {
        const item = items.find(({ id }) => id === part.id)!
        expect(item.thickness).toBe(group.thickness)
        expect([part.spanX, part.spanY].sort((a, b) => a - b)).toStrictEqual(
          [item.length, item.width].sort((a, b) => a - b),
        )
        expect(part.x).toBeGreaterThanOrEqual(0)
        expect(part.y).toBeGreaterThanOrEqual(0)
        expect(part.x + part.spanX).toBeLessThanOrEqual(stock.length)
        expect(part.y + part.spanY).toBeLessThanOrEqual(stock.width)
      }
    }
  }
}

/** Repeatable random numbers from 0 to 1, independent of the planner's own. */
function randomFrom(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let mixed = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 2 ** 32
  }
}

function randomJob(seed: number) {
  const random = randomFrom(seed)
  const between = (low: number, high: number) =>
    low + Math.floor(random() * (high - low + 1))
  const pick = <T>(values: T[]) => values[between(0, values.length - 1)]!
  const tiny = seed % 4 === 0
  const stock: SheetStock = tiny
    ? { length: between(1, 40), width: between(1, 40), kerf: between(0, 6) }
    : {
        length: pick([2440, 2500, 2800, 3050, 1525, 1220]),
        width: pick([1220, 1250, 2070, 1525, 610, 2800]),
        kerf: pick([0, 1, 3, 4, 5, 30]),
      }
  // Half of the jobs repeat a few sizes, as cabinets do.
  const repeated = [between(100, 800), between(100, 800), between(50, 600)]
  const side = (largest: number) =>
    seed % 2 ? pick(repeated) : between(1, largest)
  const items = parts(
    Array.from({ length: between(1, 25) }, () => [
      tiny ? between(1, 45) : side(2600),
      tiny ? between(1, 45) : side(1300),
      pick([18, 18, 6]),
    ]),
  )
  return { items, stock }
}

const placedIds = (items: CutListItem[], stock: SheetStock) =>
  deriveSheetLayout(items, stock)
    .groups.flatMap((group) => group.sheets)
    .flatMap((sheet) => sheet.parts.map((part) => part.id))
    .sort()

describe('deriveSheetLayout', () => {
  it('needs no cut for a part the size of the sheet', () => {
    const { groups } = deriveSheetLayout(parts([[2440, 1220]]), STOCK)
    expect(groups[0]).toMatchObject({ cuts: 0, waste: 0 })
    expect(groups[0]!.sheets[0]!.parts[0]).toMatchObject({
      x: 0,
      y: 0,
      spanX: 2440,
      spanY: 1220,
    })
  })

  it('makes one cut for parts that share the full width', () => {
    const items = parts([
      [1218, 1220],
      [1218, 1220],
    ])
    const { groups } = deriveSheetLayout(items, STOCK)
    expect(groups[0]!.sheets).toHaveLength(1)
    expect(groups[0]!.sheets[0]!.cuts).toStrictEqual([
      { order: 1, axis: 'x', position: 1218, from: 0, to: 1220 },
    ])
  })

  it('leaves room for the kerf between parts', () => {
    const items = parts([
      [1219, 1220],
      [1219, 1220],
    ])
    expect(deriveSheetLayout(items, STOCK).groups[0]!.sheets).toHaveLength(2)
    expect(
      deriveSheetLayout(items, { ...STOCK, kerf: 2 }).groups[0]!.sheets,
    ).toHaveLength(1)
  })

  it('still cuts off a sliver thinner than the kerf', () => {
    const { groups } = deriveSheetLayout(parts([[2438, 1220]]), STOCK)
    expect(groups[0]!.cuts).toBe(1)
  })

  it('turns a part to fit it and gathers parts of one width for fewer cuts', () => {
    const { groups } = deriveSheetLayout(parts([[600, 2400]]), STOCK)
    expect(groups[0]!.sheets[0]!.parts[0]).toMatchObject({
      spanX: 2400,
      spanY: 600,
    })
    const strip = parts([
      [800, 300],
      [500, 400],
      [800, 400],
      [700, 300],
      [700, 400],
    ])
    // Two rips free the strips, then each 400 strip needs two crosscuts.
    expect(deriveSheetLayout(strip, STOCK).groups[0]!.cuts).toBeLessThanOrEqual(
      7,
    )
  })

  it('tries a part both ways round when it opens a new sheet', () => {
    // Found by comparing with an exhaustive search: 5 cuts is the true minimum.
    const items = parts([
      [437, 748],
      [583, 449],
      [583, 843],
    ])
    expect(deriveSheetLayout(items, STOCK).groups[0]!.cuts).toBe(5)
  })

  it('keeps each thickness on its own sheets, thickest first', () => {
    const { groups } = deriveSheetLayout(
      parts([
        [500, 500, 3],
        [500, 500, 18],
      ]),
      STOCK,
    )
    expect(groups.map((group) => group.thickness)).toStrictEqual([18, 3])
    expect(groups.map((group) => group.sheets.length)).toStrictEqual([1, 1])
  })

  it('reports parts that fit neither way instead of dropping them', () => {
    const items = parts([
      [3000, 500],
      [500, 500],
    ])
    const layout = deriveSheetLayout(items, STOCK)
    expect(layout.tooLarge.map((item) => item.id)).toStrictEqual(['P1'])
    expect(placedIds(items, STOCK)).toStrictEqual(['P2'])
  })

  it('reports waste as the share of board that is no part', () => {
    const { groups } = deriveSheetLayout(parts([[1220, 1220]]), STOCK)
    expect(groups[0]!.waste).toBeCloseTo(0.5, 3)
  })

  it('returns no sheets without parts', () => {
    expect(deriveSheetLayout([], STOCK)).toStrictEqual({
      groups: [],
      tooLarge: [],
    })
  })

  it.each([
    ['the default cabinet', createDefaultProject()],
    ['a large design', template2 as unknown as Project],
  ])(
    'lays out %s so it can really be sawn, the same way each time',
    (_, project) => {
      const result = deriveCutList(project)
      if (!result.available) throw new Error('expected a cut list')
      for (const stock of [
        STOCK,
        { length: 2800, width: 2070, kerf: 3 },
        { length: 3050, width: 1525, kerf: 0 },
      ]) {
        const layout = deriveSheetLayout(result.items, stock)
        const fitted = result.items.filter(
          (item) => !layout.tooLarge.includes(item),
        )
        expect(placedIds(result.items, stock)).toStrictEqual(
          fitted.map((item) => item.id).sort(),
        )
        for (const group of layout.groups)
          for (const sheet of group.sheets) sawSheet(sheet, stock)
        expect(deriveSheetLayout(result.items, stock)).toStrictEqual(layout)
      }
    },
  )

  it('uses a sheet fewer for a cut more when sheets come first', () => {
    const items = parts([
      [797, 597],
      [500, 900],
      [1000, 1100],
      [1000, 300],
    ])
    const board = (priority?: SheetPriority) =>
      deriveSheetLayout(items, STOCK, priority).groups[0]!
    expect(board()).toStrictEqual(board('cuts'))
    expect(board('cuts')).toMatchObject({ cuts: 7 })
    expect(board('cuts').sheets).toHaveLength(2)
    expect(board('sheets')).toMatchObject({ cuts: 8 })
    expect(board('sheets').sheets).toHaveLength(1)
    expect(board('sheets').waste).toBeLessThan(board('cuts').waste)
  })

  it('keeps finding a plan this good for a large design', () => {
    const result = deriveCutList(template2 as unknown as Project)
    if (!result.available) throw new Error('expected a cut list')
    const board = deriveSheetLayout(result.items, STOCK).groups[0]!
    expect(board.cuts).toBeLessThanOrEqual(113)
    expect(board.sheets.length).toBeLessThanOrEqual(7)
  })

  it('turns parts on a sheet given with its short side first', () => {
    const stock = { length: 1220, width: 2440, kerf: 4 }
    const items = parts([[2400, 600]])
    const layout = deriveSheetLayout(items, stock)
    expect(layout.tooLarge).toStrictEqual([])
    expect(layout.groups[0]!.sheets[0]!.parts[0]).toMatchObject({
      spanX: 600,
      spanY: 2400,
    })
    expectSoundLayout(items, stock, layout)
  })

  it('needs no room between parts without a kerf', () => {
    const items = parts([
      [1220, 1220],
      [1220, 1220],
    ])
    const stock = { ...STOCK, kerf: 0 }
    const { groups } = deriveSheetLayout(items, stock)
    expect(groups[0]).toMatchObject({ cuts: 1, waste: 0 })
    expect(groups[0]!.sheets).toHaveLength(1)
  })

  it('starts a new sheet when a kerf is wider than what is left', () => {
    const items = parts([
      [1000, 1220],
      [1000, 1220],
    ])
    const stock = { ...STOCK, kerf: 1000 }
    const layout = deriveSheetLayout(items, stock)
    expect(layout.groups[0]!.sheets).toHaveLength(2)
    expectSoundLayout(items, stock, layout)
  })

  it('never cuts between two pieces of waste', () => {
    const { groups } = deriveSheetLayout(parts([[500, 300]]), STOCK)
    expect(groups[0]!.cuts).toBe(2)
  })

  it('stays sound when everything is too large', () => {
    const items = parts([[3000, 3000]])
    expect(deriveSheetLayout(items, STOCK)).toStrictEqual({
      groups: [],
      tooLarge: items,
    })
  })

  it('keeps parts with the same size apart by their IDs', () => {
    const items = parts(Array.from({ length: 30 }, () => [300, 200]))
    const layout = deriveSheetLayout(items, STOCK)
    expect(placedIds(items, STOCK)).toHaveLength(30)
    expectSoundLayout(items, STOCK, layout)
  })

  it('gives each of many random jobs a plan that can really be sawn', () => {
    for (let seed = 0; seed < 300; seed++) {
      const { items, stock } = randomJob(seed)
      const fewestCuts = deriveSheetLayout(items, stock, 'cuts')
      const fewestSheets = deriveSheetLayout(items, stock, 'sheets')
      expectSoundLayout(items, stock, fewestCuts)
      expectSoundLayout(items, stock, fewestSheets)
      expect(deriveSheetLayout(items, stock, 'cuts')).toStrictEqual(fewestCuts)
      // A priority is a promise: its own measure is never the worse one.
      fewestCuts.groups.forEach((group, index) => {
        const other = fewestSheets.groups[index]!
        expect(group.cuts).toBeLessThanOrEqual(other.cuts)
        expect(other.sheets.length).toBeLessThanOrEqual(group.sheets.length)
      })
    }
  })

  it('does not change the cut list items', () => {
    const items = parts([
      [800, 300],
      [500, 400],
      [700, 300],
    ])
    const before = structuredClone(items)
    deriveSheetLayout(items, STOCK)
    expect(items).toStrictEqual(before)
  })
})
