/** Minimum gap between each drawer side and the opening side, for undermount slides. */
export const MIN_DRAWER_SIDE_CLEARANCE = 3

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
export function defaultDrawerDesign(): DrawerDesignInput {
  return {
    name: 'Simple undermount drawer',
    slideType: 'undermount',
    wallThickness: 16,
    bottomThickness: 6,
    depth: 450,
    heightPercent: 50,
    sideClearance: 5,
    bottomClearance: 14,
    topClearance: 7,
    rearClearance: 3,
    bottomRecess: 13,
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
