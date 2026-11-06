import type { CutListItem } from './deriveCutList'

/** The board and saw a layout is planned for, in the project's own units. */
export interface SheetStock {
  length: number
  width: number
  kerf: number
}

/** What a plan saves first; the other one settles the ties. */
export type SheetPriority = 'cuts' | 'sheets'

export interface SheetPart {
  id: string
  part: CutListItem['part']
  moduleName: string
  /** Position on the sheet: x runs along its length, y along its width. */
  x: number
  y: number
  /** The part's size in those two directions. */
  spanX: number
  spanY: number
}

/** One saw pass, in the order it has to be made. */
export interface SheetCut {
  order: number
  axis: 'x' | 'y'
  /** Where the saw blade's near side runs, on the axis named above. */
  position: number
  from: number
  to: number
}

export interface LaidOutSheet {
  parts: SheetPart[]
  cuts: SheetCut[]
}

export interface ThicknessLayout {
  thickness: number
  sheets: LaidOutSheet[]
  cuts: number
  /** Share of the sheets' area that isn't part of a panel, from 0 to 1. */
  waste: number
}

export interface SheetLayout {
  groups: ThicknessLayout[]
  /** Parts too large for this sheet, either way round. */
  tooLarge: CutListItem[]
}

/** A piece of board: still free, one finished part, or split by one cut. */
interface Cell {
  x: number
  y: number
  w: number
  h: number
  item?: CutListItem
  cut?: { axis: 'x' | 'y'; position: number; first: Cell; second: Cell }
}

type SplitRule = 'x-first' | 'y-first' | 'short-leftover' | 'long-leftover'
type FitRule = 'short-side' | 'long-side' | 'area'
interface Rules {
  split: SplitRule
  fit: FitRule
}

const SPLIT_RULES: SplitRule[] = [
  'x-first',
  'y-first',
  'short-leftover',
  'long-leftover',
]
const FIT_RULES: FitRule[] = ['short-side', 'long-side', 'area']
/** Tries per thickness to better the best fixed order. The seed is constant,
 * so the same design always gets the same layout. */
const SEARCH_STEPS = 400
/** A try takes time in the square of the parts, so a design with hundreds of
 * them gets fewer tries and the page stays responsive. */
const SEARCH_BUDGET = 4_000_000
const SEED = 20260611

const longSide = (item: CutListItem) => Math.max(item.length, item.width)
const shortSide = (item: CutListItem) => Math.min(item.length, item.width)
const area = (item: CutListItem) => item.length * item.width

/** Parts sharing one dimension go next to each other: one cut then frees them
 * all, which is what keeps the number of cuts down. */
function groupedBy(
  items: CutListItem[],
  side: (item: CutListItem) => number,
): CutListItem[] {
  const total = new Map<number, number>()
  for (const item of items)
    total.set(side(item), (total.get(side(item)) ?? 0) + area(item))
  return items.toSorted(
    (a, b) =>
      total.get(side(b))! - total.get(side(a))! ||
      side(b) - side(a) ||
      area(b) - area(a),
  )
}

const startingOrders = (items: CutListItem[]) => [
  items.toSorted((a, b) => area(b) - area(a)),
  items.toSorted(
    (a, b) => longSide(b) - longSide(a) || shortSide(b) - shortSide(a),
  ),
  items.toSorted(
    (a, b) => shortSide(b) - shortSide(a) || longSide(b) - longSide(a),
  ),
  groupedBy(items, shortSide),
  groupedBy(items, longSide),
]

function split(cell: Cell, axis: 'x' | 'y', size: number, kerf: number) {
  const position = (axis === 'x' ? cell.x : cell.y) + size
  const rest = (axis === 'x' ? cell.w : cell.h) - size - kerf
  const first: Cell =
    axis === 'x'
      ? { x: cell.x, y: cell.y, w: size, h: cell.h }
      : { x: cell.x, y: cell.y, w: cell.w, h: size }
  const second: Cell =
    axis === 'x'
      ? { x: position + kerf, y: cell.y, w: rest, h: cell.h }
      : { x: cell.x, y: position + kerf, w: cell.w, h: rest }
  cell.cut = { axis, position, first, second }
  return { first, second }
}

/** Takes a part out of a free cell and returns what is still free of it. */
function place(
  cell: Cell,
  item: CutListItem,
  w: number,
  h: number,
  rule: SplitRule,
  kerf: number,
): Cell[] {
  const leftoverX = cell.w - w
  const leftoverY = cell.h - h
  const xFirst =
    rule === 'x-first' ||
    (rule === 'short-leftover' && leftoverX <= leftoverY) ||
    (rule === 'long-leftover' && leftoverX > leftoverY)
  const free: Cell[] = []
  let target = cell
  for (const axis of xFirst ? (['x', 'y'] as const) : (['y', 'x'] as const)) {
    const size = axis === 'x' ? w : h
    if ((axis === 'x' ? target.w : target.h) === size) continue
    const { first, second } = split(target, axis, size, kerf)
    if (second.w > 0 && second.h > 0) free.push(second)
    target = first
  }
  target.item = item
  return free
}

/** Lower is better. An exact fit comes first because it saves a cut. */
function fitScore(cell: Cell, w: number, h: number, rule: FitRule) {
  const leftoverX = cell.w - w
  const leftoverY = cell.h - h
  const exact = Number(leftoverX === 0) + Number(leftoverY === 0)
  const fit =
    rule === 'area'
      ? cell.w * cell.h
      : rule === 'short-side'
        ? Math.min(leftoverX, leftoverY)
        : Math.max(leftoverX, leftoverY)
  return { exact, fit }
}

interface Fit {
  cell: Cell
  w: number
  h: number
}

/** The best free spot for a part, tried both ways round. */
function bestFit(item: CutListItem, free: Cell[], rule: FitRule) {
  let best: Fit | undefined
  let bestExact = -1
  let bestFit = Infinity
  for (const cell of free)
    for (const [w, h] of [
      [item.length, item.width],
      [item.width, item.length],
    ] as const) {
      if (w > cell.w || h > cell.h) continue
      const { exact, fit } = fitScore(cell, w, h, rule)
      if (exact > bestExact || (exact === bestExact && fit < bestFit)) {
        best = { cell, w, h }
        bestExact = exact
        bestFit = fit
      }
    }
  return best
}

function pack(order: CutListItem[], stock: SheetStock, rules: Rules): Cell[] {
  const sheets: Cell[] = []
  let free: Cell[] = []
  for (const item of order) {
    let spot = bestFit(item, free, rules.fit)
    if (!spot) {
      const sheet: Cell = { x: 0, y: 0, w: stock.length, h: stock.width }
      sheets.push(sheet)
      spot = bestFit(item, [sheet], rules.fit)!
    }
    const { cell, w, h } = spot
    free = free.filter((other) => other !== cell)
    free.push(...place(cell, item, w, h, rules.split, stock.kerf))
  }
  return sheets
}

/** A piece is only ever cut to free a part, so every cut in the tree is needed. */
function countCuts(cell: Cell): number {
  if (!cell.cut) return 0
  return 1 + countCuts(cell.cut.first) + countCuts(cell.cut.second)
}

interface Score {
  cuts: number
  sheets: number
}

const score = (sheets: Cell[]): Score => ({
  cuts: sheets.reduce((sum, sheet) => sum + countCuts(sheet), 0),
  sheets: sheets.length,
})

const better = (a: Score, b: Score, priority: SheetPriority) =>
  priority === 'cuts'
    ? a.cuts - b.cuts || a.sheets - b.sheets
    : a.sheets - b.sheets || a.cuts - b.cuts

function nextRandom(state: { seed: number }) {
  state.seed = (Math.imul(state.seed, 1664525) + 1013904223) >>> 0
  return state.seed / 2 ** 32
}

function search(
  items: CutListItem[],
  stock: SheetStock,
  priority: SheetPriority,
): Cell[] {
  let best = pack(items, stock, { split: 'x-first', fit: 'short-side' })
  let bestScore = score(best)
  let bestOrder = items
  let bestRules: Rules = { split: 'x-first', fit: 'short-side' }
  const consider = (order: CutListItem[], rules: Rules) => {
    const sheets = pack(order, stock, rules)
    const result = score(sheets)
    if (better(result, bestScore, priority) >= 0) return false
    best = sheets
    bestScore = result
    bestOrder = order
    bestRules = rules
    return true
  }
  for (const order of startingOrders(items))
    for (const split of SPLIT_RULES)
      for (const fit of FIT_RULES) consider(order, { split, fit })
  if (items.length > 2) {
    const random = { seed: SEED }
    const steps = Math.min(
      SEARCH_STEPS,
      Math.floor(SEARCH_BUDGET / items.length ** 2),
    )
    for (let step = 0; step < steps; step++) {
      const order = [...bestOrder]
      const from = Math.floor(nextRandom(random) * order.length)
      const to = Math.floor(nextRandom(random) * order.length)
      const [moved] = order.splice(from, 1)
      order.splice(to, 0, moved!)
      consider(order, bestRules)
    }
  }
  return best
}

/** Searches for both priorities and compares the results, so a plan for fewest
 * cuts can never have more cuts than the plan for fewest sheets, or the reverse:
 * either search may stumble on the better plan. */
function bestPacking(
  items: CutListItem[],
  stock: SheetStock,
  priority: SheetPriority,
): Cell[] {
  const forCuts = search(items, stock, 'cuts')
  const forSheets = search(items, stock, 'sheets')
  return better(score(forCuts), score(forSheets), priority) <= 0
    ? forCuts
    : forSheets
}

function readSheet(root: Cell): LaidOutSheet {
  const parts: SheetPart[] = []
  const cuts: SheetCut[] = []
  const visit = (cell: Cell) => {
    if (cell.item) {
      const { id, part, moduleName } = cell.item
      const { x, y, w: spanX, h: spanY } = cell
      parts.push({ id, part, moduleName, x, y, spanX, spanY })
    }
    if (!cell.cut) return
    const { axis, position, first, second } = cell.cut
    cuts.push({
      order: cuts.length + 1,
      axis,
      position,
      from: axis === 'x' ? cell.y : cell.x,
      to: axis === 'x' ? cell.y + cell.h : cell.x + cell.w,
    })
    visit(first)
    visit(second)
  }
  visit(root)
  return { parts, cuts }
}

const fits = (item: CutListItem, stock: SheetStock) =>
  (item.length <= stock.length && item.width <= stock.width) ||
  (item.width <= stock.length && item.length <= stock.width)

/** Lays the parts of each thickness out on as few saw cuts or sheets as it can
 * find, whichever comes first, using guillotine cuts only: every cut runs right across the piece it splits,
 * as on a panel saw or with a track saw. Parts may be turned, because the
 * project has no grain direction. This is a search, not a proof: the result is
 * good and repeatable rather than guaranteed to be the very best. */
export function deriveSheetLayout(
  items: CutListItem[],
  stock: SheetStock,
  priority: SheetPriority = 'cuts',
): SheetLayout {
  const tooLarge = items.filter((item) => !fits(item, stock))
  const usable = items.filter((item) => fits(item, stock))
  const thicknesses = [...new Set(usable.map((item) => item.thickness))].sort(
    (a, b) => b - a,
  )
  const groups = thicknesses.map((thickness) => {
    const parts = usable.filter((item) => item.thickness === thickness)
    const sheets = bestPacking(parts, stock, priority).map(readSheet)
    const used = parts.reduce((sum, item) => sum + area(item), 0)
    return {
      thickness,
      sheets,
      cuts: sheets.reduce((sum, sheet) => sum + sheet.cuts.length, 0),
      waste: 1 - used / (sheets.length * stock.length * stock.width),
    }
  })
  return { groups, tooLarge }
}
