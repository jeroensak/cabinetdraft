import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import type { Project } from '../domain/project/types'
import { deriveCutList } from '../domain/cutlist/deriveCutList'
import { projectFilename } from '../domain/import-export/projectJson'
import { t } from '../i18n'
import { formatBare, unitSymbol } from '../units'

import { groupCutList } from './partGroups'
import { partName } from './partNames'
import fontUrl from '../assets/fonts/NotoSans-Regular.ttf?url'

/** Render validated domain rows directly; no DOM or SVG measurements. */
export function createCutListPdf(project: Project, font: string) {
  const result = deriveCutList(project)
  if (!result.available || result.items.length === 0)
    throw new Error('No valid cut list is available')
  const measureUnit = project.settings.unit ?? 'mm'
  const symbol = unitSymbol(measureUnit)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
    putOnlyUsedFonts: true,
    compress: true,
  })
  doc.addFileToVFS('NotoSans.ttf', font)
  doc.addFont('NotoSans.ttf', 'NotoSans', 'normal')
  doc.setFont('NotoSans', 'normal')
  doc.setProperties({
    title: `${project.name} - ${t('cutList.title')}`,
    creator: t('app.name'),
  })
  const columns = [
    t('cutList.id'),
    t('cutList.cabinet'),
    t('cutList.part'),
    t('cutList.qty'),
    t('cutList.length', { unit: symbol }),
    t('cutList.width', { unit: symbol }),
    t('cutList.thickness', { unit: symbol }),
  ]
  let startY = 42
  for (const group of groupCutList(result.items)) {
    autoTable(doc, {
      startY,
      margin: { top: 42, right: 15, bottom: 20, left: 15 },
      // The title is part of the head, so it repeats on each page of its list
      // and can never be stranded at the bottom of a page without its rows.
      head: [
        [
          {
            content: `${group.title} (${group.items.length})`,
            colSpan: columns.length,
            styles: { fontSize: 11, fillColor: [255, 255, 255], textColor: 31 },
          },
        ],
        columns,
      ],
      body: group.items.map((item) => [
        item.id,
        item.moduleName,
        partName(item, measureUnit),
        item.quantity,
        formatBare(item.length, measureUnit),
        formatBare(item.width, measureUnit),
        formatBare(item.thickness, measureUnit),
      ]),
      theme: 'striped',
      styles: {
        font: 'NotoSans',
        fontStyle: 'normal',
        fontSize: 9,
        cellPadding: 2.5,
        textColor: [31, 41, 51],
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: [37, 109, 103],
        textColor: 255,
        fontStyle: 'normal',
      },
      alternateRowStyles: { fillColor: [246, 244, 239] },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 43 },
        2: { cellWidth: 60 },
        3: { cellWidth: 18, halign: 'right' },
        4: { cellWidth: 30, halign: 'right' },
        5: { cellWidth: 30, halign: 'right' },
        6: { cellWidth: 36, halign: 'right' },
      },
      showHead: 'everyPage',
      rowPageBreak: 'avoid',
    })
    startY =
      (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 8
  }
  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page)
    doc.setFontSize(19)
    doc.setTextColor(31, 41, 51)
    doc.text(t('cutList.title'), 15, 17)
    doc.setFontSize(10)
    const lines: string[] = doc.splitTextToSize(project.name, 267)
    doc.text(lines.length > 2 ? [lines[0], lines[1] + '…'] : lines, 15, 24)
    doc.setFontSize(8)
    doc.setTextColor(100)
    doc.text(
      t('pdf.summary', {
        cabinets: t('count.cabinets', { count: project.modules.length }),
        parts: t('count.parts', { count: result.items.length }),
      }),
      15,
      36,
    )
    doc.setTextColor(100)
    doc.text(
      t('pdf.note', {
        unit: t(measureUnit === 'inch' ? 'unit.inchPlural' : 'unit.mmPlural'),
      }),
      15,
      199,
    )
    doc.text(t('pdf.page', { page, pages }), 282, 199, { align: 'right' })
  }
  return doc
}

export async function downloadCutListPdf(project: Project) {
  const response = await fetch(fontUrl)
  if (!response.ok) throw new Error('Could not load PDF font')
  const bytes = new Uint8Array(await response.arrayBuffer())
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  const doc = createCutListPdf(project, btoa(binary))
  await doc.save(
    projectFilename(project.name).replace(/\.json$/, '-cut-list.pdf'),
    { returnPromise: true },
  )
}
