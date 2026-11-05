import type { CabinetModule } from '../cabinet/types'
import { deriveCarcassDimensions } from '../cabinet/deriveCarcassDimensions'
import type { DrawerFront } from '../fronts/types'
import { deriveFrontGeometry } from '../fronts/deriveFrontGeometry'
import type { ProjectSettings } from '../project/types'
import type { PhysicalPanel } from '../geometry/physicalPanel'
import { horizontalBounds, verticalBounds } from '../spaces/boundaries'
import {
  MIN_DRAWER_SIDE_CLEARANCE,
  type DrawerDesign,
  type DrawerDesignInput,
} from './types'

export interface DrawerIssue {
  code: 'invalid-drawer-design' | 'drawer-does-not-fit' | 'invalid-drawer-panel'
  message: string
  field?: string
}

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
export function validateDrawerDesign(design: DrawerDesignInput): DrawerIssue[] {
  const issues: DrawerIssue[] = []
  if (!design.name.trim())
    issues.push({
      code: 'invalid-drawer-design',
      field: 'name',
      message: 'Give the drawer design a name.',
    })
  if (design.slideType !== 'undermount')
    issues.push({
      code: 'invalid-drawer-design',
      field: 'slideType',
      message: 'Only undermount slides are supported.',
    })
  const minimums = {
    wallThickness: 1,
    bottomThickness: 1,
    depth: 1,
    sideClearance: MIN_DRAWER_SIDE_CLEARANCE,
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
        message: `${measurementLabels[field]} must be a whole number of at least ${minimums[field]} mm.`,
      })
  }
  if (
    design.height !== null &&
    (!Number.isSafeInteger(design.height) || design.height < 1)
  )
    issues.push({
      code: 'invalid-drawer-design',
      field: 'height',
      message: 'Side height must be a positive whole number of millimetres.',
    })
  if (design.depth <= 2 * design.wallThickness)
    issues.push({
      code: 'invalid-drawer-design',
      field: 'depth',
      message: 'Box depth must leave room between the box front and back.',
    })
  if (
    design.height !== null &&
    design.bottomRecess + design.bottomThickness >= design.height
  )
    issues.push({
      code: 'invalid-drawer-design',
      field: 'height',
      message: 'The recessed bottom must fit below the top of the sides.',
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
  /** Opening rectangle (module-local mm) the box is fitted into. */
  opening: { left: number; right: number; bottom: number; top: number }
  /** Five box panels; the overlay front is derived by the front pipeline. */
  boxPanels: PhysicalPanel[]
  frontPanels: PhysicalPanel[]
  issues: DrawerIssue[]
}

/** Canonical drawer box geometry in module-local mm.
 * Four equal-height walls: full-depth sides, box front/back between the sides,
 * and a bottom between all four walls raised by `bottomRecess` for undermount
 * slides. No hardware, grooves, notches or drilling are generated.
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
  // Automatic height is a placement choice, like centred shelves: whole mm.
  const height = design.height ?? Math.round(openingHeight / 2)
  const depth = design.depth
  const t = design.wallThickness
  const x = horizontal.left + design.sideClearance
  const y = vertical.bottom + design.bottomClearance
  const issues = validateDrawerDesign(design)
  const { carcassDepth } = deriveCarcassDimensions(module, settings)
  if (height + design.bottomClearance + design.topClearance > openingHeight)
    issues.push({
      code: 'drawer-does-not-fit',
      field: 'height',
      message: `The box height plus vertical clearances (${height + design.bottomClearance + design.topClearance} mm) exceeds the ${openingHeight} mm opening.`,
    })
  if (depth + design.rearClearance > carcassDepth)
    issues.push({
      code: 'drawer-does-not-fit',
      field: 'depth',
      message: `The box depth plus rear clearance (${depth + design.rearClearance} mm) exceeds the ${carcassDepth} mm cabinet depth.`,
    })
  if (
    design.height === null &&
    design.bottomRecess + design.bottomThickness >= height
  )
    issues.push({
      code: 'drawer-does-not-fit',
      field: 'height',
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
  const boxPanels: PhysicalPanel[] = [
    panel('drawer-side-left', height, depth, t, 'side', { x, y, z: 0 }),
    panel('drawer-side-right', height, depth, t, 'side', {
      x: x + width - t,
      y,
      z: 0,
    }),
    panel('drawer-box-front', height, inner, t, 'face', { x: x + t, y, z: 0 }),
    panel('drawer-box-back', height, inner, t, 'face', {
      x: x + t,
      y,
      z: depth - t,
    }),
    panel(
      'drawer-bottom',
      inner,
      depth - 2 * t,
      design.bottomThickness,
      'horizontal',
      {
        x: x + t,
        y: y + design.bottomRecess,
        z: t,
      },
    ),
  ]
  for (const p of boxPanels)
    for (const dimension of ['length', 'width', 'thickness'] as const)
      if (!Number.isSafeInteger(p[dimension]) || p[dimension] <= 0)
        issues.push({
          code: 'invalid-drawer-panel',
          field: dimension,
          message: `${partLabels[p.source.type as DrawerBoxPart]}: ${dimension} must be a positive whole number of millimetres.`,
        })
  return {
    width,
    height,
    depth,
    openingWidth,
    openingHeight,
    opening: {
      left: horizontal.left,
      right: horizontal.right,
      bottom: vertical.bottom,
      top: vertical.top,
    },
    boxPanels,
    frontPanels: deriveFrontGeometry(module, settings, front).panels,
    issues,
  }
}
