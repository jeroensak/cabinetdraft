import type { CabinetModule } from '../cabinet/types'
import { deriveCarcassDimensions } from '../cabinet/deriveCarcassDimensions'
import type { DrawerFront } from '../fronts/types'
import { deriveFrontGeometry } from '../fronts/deriveFrontGeometry'
import type { ProjectSettings } from '../project/types'
import type { MeasurementUnit } from '../project/units'

import type { PhysicalPanel } from '../geometry/physicalPanel'
import { horizontalBounds, verticalBounds } from '../spaces/boundaries'
import {
  minDrawerSideClearance,
  type DrawerDesign,
  type DrawerDesignInput,
} from './types'

export interface DrawerIssue {
  code: 'invalid-drawer-design' | 'drawer-does-not-fit' | 'invalid-drawer-panel'
  message: string
  field?: string
  /** What went wrong, for the UI to word; `message` is the developer fallback. */
  reason: DrawerIssueReason
  values?: Record<string, string | number>
}

export type DrawerIssueReason =
  | 'blank-name'
  | 'slide-type'
  | 'measurement'
  | 'box-height-percent'
  | 'front-height-percent'
  | 'front-style'
  | 'front-mount'
  | 'box-too-shallow'
  | 'height-overflow'
  | 'depth-overflow'
  | 'inset-depth-overflow'
  | 'no-usable-height'
  | 'panel-size'

export type DrawerBoxPart =
  | 'drawer-side-left'
  | 'drawer-side-right'
  | 'drawer-box-front'
  | 'drawer-box-back'
  | 'drawer-bottom'

const partLabels: Record<DrawerBoxPart, string> = {
  'drawer-side-left': 'Left side',
  'drawer-side-right': 'Right side',
  'drawer-box-front': 'Box front',
  'drawer-box-back': 'Box back',
  'drawer-bottom': 'Bottom',
}

const measurementLabels = {
  wallThickness: 'Wall thickness',
  bottomThickness: 'Bottom thickness',
  depth: 'Box depth',
  sideClearance: 'Side clearance',
  bottomClearance: 'Bottom clearance',
  topClearance: 'Top clearance',
  rearClearance: 'Rear clearance',
  bottomRecess: 'Bottom recess',
} as const

/** Space-independent checks. Commands reject designs that fail these. */
export function validateDrawerDesign(
  design: DrawerDesignInput,
  unit: MeasurementUnit = 'mm',
): DrawerIssue[] {
  const issues: DrawerIssue[] = []
  if (!design.name.trim())
    issues.push({
      code: 'invalid-drawer-design',
      field: 'name',
      reason: 'blank-name',
      message: 'Give the drawer design a name.',
    })
  if (design.slideType !== 'undermount')
    issues.push({
      code: 'invalid-drawer-design',
      field: 'slideType',
      reason: 'slide-type',
      message: 'Only undermount slides are supported.',
    })
  const minimums = {
    wallThickness: 1,
    bottomThickness: 1,
    depth: 1,
    sideClearance: minDrawerSideClearance(unit),
    bottomClearance: 0,
    topClearance: 0,
    rearClearance: 0,
    bottomRecess: 0,
  }
  for (const field of Object.keys(minimums) as (keyof typeof minimums)[]) {
    const value = design[field]
    if (!Number.isSafeInteger(value) || value < minimums[field])
      issues.push({
        code: 'invalid-drawer-design',
        field,
        reason: 'measurement',
        values: { field, minimum: minimums[field] },
        message: `${measurementLabels[field]} must be a whole number of at least ${minimums[field]} mm.`,
      })
  }
  if (
    !Number.isSafeInteger(design.heightPercent) ||
    design.heightPercent < 1 ||
    design.heightPercent > 100
  )
    issues.push({
      code: 'invalid-drawer-design',
      field: 'heightPercent',
      reason: 'box-height-percent',
      message: 'Box height must be a whole percentage from 1 to 100.',
    })
  if (
    !Number.isSafeInteger(design.frontHeightPercent) ||
    design.frontHeightPercent < 1 ||
    design.frontHeightPercent > 100
  )
    issues.push({
      code: 'invalid-drawer-design',
      field: 'frontHeightPercent',
      reason: 'front-height-percent',
      message: 'Front height must be a whole percentage from 1 to 100.',
    })
  if (design.frontStyle !== 'full' && design.frontStyle !== 'wave')
    issues.push({
      code: 'invalid-drawer-design',
      field: 'frontStyle',
      reason: 'front-style',
      message: 'Choose a full or wave top drawer front.',
    })
  if (design.frontMount !== 'overlay' && design.frontMount !== 'inset')
    issues.push({
      code: 'invalid-drawer-design',
      field: 'frontMount',
      reason: 'front-mount',
      message: 'Choose an overlay or inset drawer front.',
    })
  if (design.depth <= 2 * design.wallThickness)
    issues.push({
      code: 'invalid-drawer-design',
      field: 'depth',
      reason: 'box-too-shallow',
      message: 'Box depth must leave room between the box front and back.',
    })
  return issues
}

export interface DrawerGeometry {
  /** Outside box dimensions. Width always follows the opening. */
  width: number
  height: number
  depth: number
  openingWidth: number
  openingHeight: number
  /** Full depth available behind the opening, from the carcass front. */
  carcassDepth: number
  /** The gaps set on the design; above and behind are minimums. */
  gaps: { side: number; bottom: number; top: number; rear: number }
  /** Opening rectangle (module-local mm) the box is fitted into. */
  opening: { left: number; right: number; bottom: number; top: number }
  /** Five box panels; the overlay front is derived by the front pipeline. */
  boxPanels: PhysicalPanel[]
  frontPanels: PhysicalPanel[]
  issues: DrawerIssue[]
}

/** Canonical drawer box geometry in module-local mm.
 * Four equal-height walls: full-depth sides and box front/back between the sides.
 * The bottom slots into a groove in all four walls, half a wall thickness deep and
 * raised by `bottomRecess` for undermount slides, so it reaches half a wall past
 * each inner face. No hardware, notches or drilling are generated.
 */
export function deriveDrawerGeometry(
  module: CabinetModule,
  settings: ProjectSettings,
  front: DrawerFront,
  design: DrawerDesign,
): DrawerGeometry {
  const horizontal = horizontalBounds(module, settings, front)
  const vertical = verticalBounds(module, settings, front)
  const openingWidth = horizontal.right - horizontal.left
  const openingHeight = vertical.top - vertical.bottom
  const width = openingWidth - 2 * design.sideClearance
  // Percentage height is a placement choice, like centred shelves: whole mm.
  const height = Math.round((openingHeight * design.heightPercent) / 100)
  const depth = design.depth
  const t = design.wallThickness
  const x = horizontal.left + design.sideClearance
  const y = vertical.bottom + design.bottomClearance
  // An inset front fills the first part of the opening, so the box starts behind it.
  const z = design.frontMount === 'inset' ? settings.frontThickness : 0
  const issues = validateDrawerDesign(design, settings.unit)

  const { carcassDepth } = deriveCarcassDimensions(module, settings)
  if (height + design.bottomClearance + design.topClearance > openingHeight)
    issues.push({
      code: 'drawer-does-not-fit',
      field: 'height',
      reason: 'height-overflow',
      values: {
        total: height + design.bottomClearance + design.topClearance,
        opening: openingHeight,
      },
      message: `The box height plus vertical clearances (${height + design.bottomClearance + design.topClearance} mm) exceeds the ${openingHeight} mm opening.`,
    })
  if (z + depth + design.rearClearance > carcassDepth)
    issues.push({
      code: 'drawer-does-not-fit',
      field: 'depth',
      reason: z ? 'inset-depth-overflow' : 'depth-overflow',
      values: {
        total: z + depth + design.rearClearance,
        carcass: carcassDepth,
      },
      message: z
        ? `The inset front, box depth and rear clearance (${z + depth + design.rearClearance} mm) exceed the ${carcassDepth} mm cabinet depth.`
        : `The box depth plus rear clearance (${depth + design.rearClearance} mm) exceeds the ${carcassDepth} mm cabinet depth.`,
    })
  if (design.bottomRecess + design.bottomThickness >= height)
    issues.push({
      code: 'drawer-does-not-fit',
      field: 'height',
      reason: 'no-usable-height',
      message: 'The recessed bottom leaves no usable height in this drawer.',
    })
  const panel = (
    type: DrawerBoxPart,
    length: number,
    panelWidth: number,
    thickness: number,
    orientation: PhysicalPanel['orientation'],
    position: PhysicalPanel['position'],
  ): PhysicalPanel => ({
    moduleId: module.id,
    source: { type, frontId: front.id },
    length,
    width: panelWidth,
    thickness,
    orientation,
    position,
  })
  const inner = width - 2 * t
  const groove = {
    depth: t / 2,
    width: design.bottomThickness,
    fromEdge: design.bottomRecess,
  }
  const walled = (wall: PhysicalPanel) => ({ ...wall, groove })
  const boxPanels: PhysicalPanel[] = [
    walled(panel('drawer-side-left', height, depth, t, 'side', { x, y, z })),
    walled(
      panel('drawer-side-right', height, depth, t, 'side', {
        x: x + width - t,
        y,
        z,
      }),
    ),
    walled(
      panel('drawer-box-front', height, inner, t, 'face', { x: x + t, y, z }),
    ),
    walled(
      panel('drawer-box-back', height, inner, t, 'face', {
        x: x + t,
        y,
        z: z + depth - t,
      }),
    ),
    panel(
      'drawer-bottom',
      inner + t,
      depth - t,
      design.bottomThickness,
      'horizontal',
      {
        x: x + t / 2,
        y: y + design.bottomRecess,
        z: z + t / 2,
      },
    ),
  ]
  for (const p of boxPanels)
    for (const dimension of ['length', 'width', 'thickness'] as const)
      if (!Number.isSafeInteger(p[dimension]) || p[dimension] <= 0)
        issues.push({
          code: 'invalid-drawer-panel',
          field: dimension,
          reason: 'panel-size',
          values: { part: p.source.type, dimension },
          message: `${partLabels[p.source.type as DrawerBoxPart]}: ${dimension} must be a positive whole number of millimetres.`,
        })
  return {
    width,
    height,
    depth,
    openingWidth,
    openingHeight,
    carcassDepth,
    gaps: {
      side: design.sideClearance,
      bottom: design.bottomClearance,
      top: design.topClearance,
      rear: design.rearClearance,
    },
    opening: {
      left: horizontal.left,
      right: horizontal.right,
      bottom: vertical.bottom,
      top: vertical.top,
    },
    boxPanels,
    frontPanels: deriveFrontGeometry(module, settings, front, design).panels,
    issues,
  }
}
