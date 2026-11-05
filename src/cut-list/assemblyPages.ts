import type { jsPDF } from 'jspdf'
import type { LabelledPanel } from '../domain/cutlist/deriveCutList'
import type { PhysicalPanel } from '../domain/geometry/physicalPanel'
import { orderFaces } from '../editor/canvas/orderFaces'
import { panelFaces, projectPoint } from '../editor/canvas/projection'

const ORIGIN = { x: 0, y: 0, z: 0 }
const TOP = 52
const BOTTOM = 186
const LEFT = 15
const VIEW_WIDTH = 128
const VIEW_GAP = 11

const isFront = (panel: PhysicalPanel) =>
  panel.source.type === 'door' || panel.source.type === 'drawer'
const isDrawerBox = (panel: PhysicalPanel) =>
  panel.source.type.startsWith('drawer-')

/** A spot on the visible part of a panel, clear of shelves on the back. */
function labelPoint(panel: PhysicalPanel) {
  const { position: p, length, width, thickness, orientation } = panel
  if (orientation === 'horizontal')
    return { x: p.x + length / 2, y: p.y + thickness / 2, z: p.z }
  if (orientation === 'side')
    return { x: p.x + thickness / 2, y: p.y + length / 2, z: p.z }
  const share = panel.source.type === 'back' ? 0.78 : 0.5
  return { x: p.x + width / 2, y: p.y + length * share, z: p.z }
}

/** The drawing's labels drop the cabinet prefix, and a drawer box is one item. */
const shortId = (id: string) =>
  id.replace(/^C\d+-/, '').replace(/(DRAWER-\d+)-BOX-FRONT$/, '$1')

function drawView(
  doc: jsPDF,
  title: string,
  left: number,
  panels: LabelledPanel[],
  labelled: (panel: PhysicalPanel) => boolean,
) {
  const faces = orderFaces(
    panels
      .flatMap(({ panel }) =>
        panelFaces(panel, ORIGIN).map((face) => ({
          ...face,
          layer: isFront(panel) ? 1 : 0,
        })),
      )
      .sort((a, b) => a.layer - b.layer || a.distance - b.distance),
  )
  const points = faces.flatMap((face) => face.outline)
  if (!points.length) return
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const spanX = Math.max(1, Math.max(...xs) - minX)
  const spanY = Math.max(1, Math.max(...ys) - minY)
  const scale = Math.min(VIEW_WIDTH / spanX, (BOTTOM - TOP) / spanY)
  const offsetX = left + (VIEW_WIDTH - spanX * scale) / 2
  const offsetY = TOP + (BOTTOM - TOP - spanY * scale) / 2
  const place = (point: { x: number; y: number }) => ({
    x: offsetX + (point.x - minX) * scale,
    y: offsetY + (point.y - minY) * scale,
  })

  doc.setFontSize(10)
  doc.setTextColor(31, 41, 51)
  doc.text(title, left, 46)
  doc.setDrawColor(90, 98, 92)
  doc.setLineWidth(0.15)
  for (const face of faces) {
    const fill = { front: 250, top: 240, right: 226 }[face.side] ?? 240
    doc.setFillColor(fill, fill - 2, fill - 8)
    const outline = face.outline.map(place)
    const steps = outline
      .slice(1)
      .map((point, index) => [
        point.x - outline[index]!.x,
        point.y - outline[index]!.y,
      ])
    doc.lines(steps, outline[0]!.x, outline[0]!.y, [1, 1], 'FD', true)
  }
  doc.setFontSize(6)
  for (const { id, panel } of panels) {
    if (!labelled(panel)) continue
    const text = shortId(id)
    const { x, y } = place(projectPoint(labelPoint(panel)))
    const width = doc.getTextWidth(text) + 1.4
    doc.setFillColor(255, 255, 255)
    doc.rect(x - width / 2, y - 1.6, width, 2.6, 'F')
    doc.setTextColor(37, 109, 103)
    doc.text(text, x, y + 0.3, { align: 'center' })
  }
}

/** One page per cabinet. Sizes come from the canonical panels; only the
 * projection is shared with the Designer's drawing. */
export function addAssemblyPage(
  doc: jsPDF,
  panels: LabelledPanel[],
  titles: { structure: string; fronts: string },
) {
  doc.addPage('a4', 'landscape')
  const structure = panels.filter(({ panel }) => !isFront(panel))
  drawView(
    doc,
    titles.structure,
    LEFT,
    structure,
    (panel) => !isDrawerBox(panel) || panel.source.type === 'drawer-box-front',
  )
  drawView(doc, titles.fronts, LEFT + VIEW_WIDTH + VIEW_GAP, panels, isFront)
}
