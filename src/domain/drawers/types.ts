import { inches, type MeasurementUnit } from '../project/units'

/** Minimum gap between each drawer side and the opening side, for undermount
 * slides: 3 mm, or the 1/8" that covers it in an inch design. */
export const minDrawerSideClearance = (unit: MeasurementUnit = 'mm') =>
  unit === 'inch' ? inches(1 / 8) : 3

/** A reusable construction recipe. Derived width and height are never stored. */
export interface DrawerDesign {
  id: string
  name: string
  slideType: 'undermount'
  wallThickness: number
  bottomThickness: number
  depth: number
  /** Box height as a whole percentage of the opening height; the result rounds to whole mm. */
  heightPercent: number
  /** Gap on each side between the box's outside and the opening. */
  sideClearance: number
  bottomClearance: number
  topClearance: number
  rearClearance: number
  /** Bottom panel's underside above the lower edge of the four equal-height walls. */
  bottomRecess: number
  /** Full rectangle, or a top edge that dips towards the middle. */
  frontStyle: 'full' | 'wave'
  /** Overlay sits on the carcass front; inset sits inside the opening. */
  frontMount: 'overlay' | 'inset'
  /** Whole percentage of the front's full height, measured from its bottom edge. */
  frontHeightPercent: number
}
export type DrawerDesignInput = Omit<DrawerDesign, 'id'>
export type DrawerFrontOptions = Pick<
  DrawerDesign,
  'frontStyle' | 'frontMount' | 'frontHeightPercent'
>

/** Generic editable dimensions, not a hardware compatibility certification. */
export function defaultDrawerDesign(
  unit: MeasurementUnit = 'mm',
): DrawerDesignInput {
  const size = (mm: number, inch: number) =>
    unit === 'inch' ? inches(inch) : mm
  return {
    name: 'Simple undermount drawer',
    slideType: 'undermount',
    wallThickness: size(18, 3 / 4),
    bottomThickness: size(6, 1 / 4),
    depth: size(450, 18),
    heightPercent: 50,
    sideClearance: size(5, 3 / 16),
    bottomClearance: size(14, 9 / 16),
    topClearance: size(7, 1 / 4),
    rearClearance: size(3, 1 / 8),
    bottomRecess: size(13, 1 / 2),
    frontStyle: 'full',
    frontMount: 'overlay',
    frontHeightPercent: 100,
  }
}

/** Explicit projection prevents derived coordinates or arbitrary fields being saved. */
export function drawerDesignData(design: DrawerDesign): DrawerDesign {
  return {
    id: design.id,
    name: design.name,
    slideType: design.slideType,
    wallThickness: design.wallThickness,
    bottomThickness: design.bottomThickness,
    depth: design.depth,
    heightPercent: design.heightPercent,
    sideClearance: design.sideClearance,
    bottomClearance: design.bottomClearance,
    topClearance: design.topClearance,
    rearClearance: design.rearClearance,
    bottomRecess: design.bottomRecess,
    frontStyle: design.frontStyle,
    frontMount: design.frontMount,
    frontHeightPercent: design.frontHeightPercent,
  }
}

/** The design shaping a drawer front; doors and box-less fronts have none. */
export function frontDesign(
  designs: readonly DrawerDesign[],
  front: { type: string; drawerDesignId?: string },
): DrawerDesign | undefined {
  return front.type === 'drawer'
    ? designs.find((design) => design.id === front.drawerDesignId)
    : undefined
}
