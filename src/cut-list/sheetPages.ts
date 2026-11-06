import type { jsPDF } from 'jspdf'
import type {
  LaidOutSheet,
  SheetLayout,
  SheetPriority,
  SheetStock,
} from '../domain/cutlist/sheetLayout'
import type { MeasurementUnit } from '../domain/project/units'
import { t } from '../i18n'
import { formatMeasure, formatSheetSize } from '../units'
import { CUT_LIST_GROUPS, partGroupOf } from './partGroups'
import {
  cutMarks,
  fitPartLabel,
  LINE_HEIGHT,
  partSizeLabel,
  sheetFontSize,
} from './sheetDrawingLayout'

const LEFT = 15
const TOP = 42
const WIDTH = 267
const HEIGHT = 142
const LEGEND_Y = 190
const POINTS_PER_MM = 72 / 25.4
/** Half a text's height, to centre it on a spot across its baseline. */
const MIDDLE = 0.35
const CUT_DASH = [1.5, 1]
const CUT_COLOUR = [179, 64, 31] as const
const BOARD_COLOUR = [241, 238, 231] as const
const LINE_COLOUR = [138, 132, 123] as const
const TEXT_COLOUR = [31, 41, 51] as const
/** The Sheets view's group colours. */
const PART_COLOUR: Record<
  (typeof CUT_LIST_GROUPS)[number]['id'],
  [number, number, number]
> = {
  bases: [234, 223, 203],
  shelves: [216, 230, 214],
  doors: [207, 227, 224],
  drawers: [242, 196, 176],
}

export interface SheetPageHeader {
  title: string
  summary: string
}

const PRIORITY_KEY = {
  cuts: 'sheets.fewestCuts',
  sheets: 'sheets.fewestSheets',
} as const

/** Text whose size is in sheet units, centred on a spot given in millimetres. */
function centredText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  millimetres: number,
  turned = false,
) {
  doc.setFontSize(millimetres * POINTS_PER_MM)
  const half = doc.getTextWidth(text) / 2
  const middle = millimetres * MIDDLE
  if (turned) doc.text(text, x + middle, y + half, { angle: 90 })
  else doc.text(text, x - half, y + middle)
}

function drawSheet(
  doc: jsPDF,
  sheet: LaidOutSheet,
  stock: SheetStock,
  unit: MeasurementUnit,
) {
  const scale = Math.min(WIDTH / stock.length, HEIGHT / stock.width)
  const toX = (value: number) => LEFT + value * scale
  const toY = (value: number) => TOP + value * scale
  const font = sheetFontSize(stock)
  doc.setLineWidth(0.2)
  doc.setDrawColor(...LINE_COLOUR)
  doc.setFillColor(...BOARD_COLOUR)
  doc.rect(LEFT, TOP, stock.length * scale, stock.width * scale, 'FD')
  for (const part of sheet.parts) {
    doc.setFillColor(...PART_COLOUR[partGroupOf(part.part)])
    doc.rect(
      toX(part.x),
      toY(part.y),
      part.spanX * scale,
      part.spanY * scale,
      'FD',
    )
    const fit = fitPartLabel(part, partSizeLabel(part, unit), font)
    if (!fit) continue
    const { lines, size, turned } = fit
    const centreX = toX(part.x + part.spanX / 2)
    const centreY = toY(part.y + part.spanY / 2)
    const lineGap = size * LINE_HEIGHT * scale
    doc.setTextColor(...TEXT_COLOUR)
    lines.forEach((line, index) => {
      const shift = (index - (lines.length - 1) / 2) * lineGap
      centredText(
        doc,
        line,
        centreX + (turned ? shift : 0),
        centreY + (turned ? 0 : shift),
        size * scale,
        turned,
      )
    })
  }
  doc.setDrawColor(...CUT_COLOUR)
  doc.setFillColor(...CUT_COLOUR)
  doc.setLineWidth(0.25)
  for (const cut of sheet.cuts) {
    const { x1, y1, x2, y2, badge, badgeX, badgeY } = cutMarks(cut, stock)
    doc.setLineDashPattern(CUT_DASH, 0)
    doc.line(toX(x1), toY(y1), toX(x2), toY(y2))
    doc.setLineDashPattern([], 0)
    doc.circle(toX(badgeX), toY(badgeY), badge * scale, 'F')
  }
  doc.setTextColor(255, 255, 255)
  for (const cut of sheet.cuts) {
    const { badgeX, badgeY } = cutMarks(cut, stock)
    centredText(doc, String(cut.order), toX(badgeX), toY(badgeY), font * scale)
  }
}

function drawLegend(doc: jsPDF) {
  doc.setFontSize(8)
  doc.setTextColor(100)
  doc.setDrawColor(...LINE_COLOUR)
  doc.setLineWidth(0.2)
  let x = LEFT
  for (const { id, titleKey } of CUT_LIST_GROUPS) {
    doc.setFillColor(...PART_COLOUR[id])
    doc.rect(x, LEGEND_Y - 2.5, 3, 3, 'FD')
    const title = t(titleKey)
    doc.text(title, x + 4.5, LEGEND_Y)
    x += 4.5 + doc.getTextWidth(title) + 8
  }
}

/** One page per sheet, so each can go to the saw on its own. Draws the sheets
 * only; the caller writes each page's header, as for every other page. */
export function addSheetPages(
  doc: jsPDF,
  layout: SheetLayout,
  stock: SheetStock & { priority: SheetPriority },
  unit: MeasurementUnit,
): SheetPageHeader[] {
  const headers: SheetPageHeader[] = []
  const setup = [
    formatSheetSize(stock.length, stock.width, unit),
    `${t('sheets.kerf')} ${formatMeasure(stock.kerf, unit)}`,
    t(PRIORITY_KEY[stock.priority]),
  ]
  if (layout.tooLarge.length > 0) {
    doc.addPage()
    doc.setFontSize(10)
    doc.setTextColor(...CUT_COLOUR)
    const text = t('sheets.tooLarge', {
      parts: layout.tooLarge.map((item) => item.id).join(', '),
    })
    doc.text(doc.splitTextToSize(text, WIDTH), LEFT, TOP + 4)
    headers.push({ title: t('pdf.sheetLayout'), summary: setup.join('  ·  ') })
  }
  for (const group of layout.groups)
    group.sheets.forEach((sheet, index) => {
      doc.addPage()
      drawSheet(doc, sheet, stock, unit)
      drawLegend(doc)
      headers.push({
        title: t('pdf.sheetTitle', {
          number: index + 1,
          total: group.sheets.length,
          thickness: formatMeasure(group.thickness, unit),
        }),
        summary: [
          ...setup,
          t('count.parts', { count: sheet.parts.length }),
          t('count.cuts', { count: sheet.cuts.length }),
        ].join('  ·  '),
      })
    })
  return headers
}
