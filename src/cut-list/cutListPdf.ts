import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import type { Project } from '../domain/project/types'
import { deriveCutList } from '../domain/cutlist/deriveCutList'
import { projectFilename } from '../domain/import-export/projectJson'
import { partNames } from './partNames'
import fontUrl from '../assets/fonts/NotoSans-Regular.ttf?url'

/** Render validated domain rows directly; no DOM or SVG measurements. */
export function createCutListPdf(project: Project, font: string) {
  const result = deriveCutList(project)
  if (!result.available || result.items.length === 0)
    throw new Error('No valid cut list is available')
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
    title: `${project.name} - Cut List`,
    creator: 'Cabinet Designer',
  })
  autoTable(doc, {
    startY: 42,
    margin: { top: 42, right: 15, bottom: 20, left: 15 },
    head: [
      [
        'ID',
        'Cabinet',
        'Part',
        'Qty',
        'Length (mm)',
        'Width (mm)',
        'Thickness (mm)',
      ],
    ],
    body: result.items.map((item) => [
      item.id,
      item.moduleName,
      partNames[item.part],
      item.quantity,
      item.length,
      item.width,
      item.thickness,
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
      0: { cellWidth: 43 },
      1: { cellWidth: 62 },
      2: { cellWidth: 32 },
      3: { cellWidth: 14, halign: 'right' },
      4: { cellWidth: 38, halign: 'right' },
      5: { cellWidth: 38, halign: 'right' },
      6: { cellWidth: 40, halign: 'right' },
    },
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    willDrawPage: () => {
      doc.setFontSize(19)
      doc.setTextColor(31, 41, 51)
      doc.text('Cut List', 15, 17)
      doc.setFontSize(10)
      const lines: string[] = doc.splitTextToSize(project.name, 267)
      doc.text(lines.length > 2 ? [lines[0], lines[1] + '…'] : lines, 15, 24)
      doc.setFontSize(8)
      doc.setTextColor(100)
      doc.text(
        `${project.modules.length} ${project.modules.length === 1 ? 'cabinet' : 'cabinets'}  ·  ${result.items.length} parts  ·  Configuration valid`,
        15,
        36,
      )
    },
  })
  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page)
    doc.setFontSize(8)
    doc.setTextColor(100)
    doc.text(
      'All dimensions in millimetres. Each row represents one physical panel.',
      15,
      199,
    )
    doc.text(`Page ${page} of ${pages}`, 282, 199, { align: 'right' })
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
