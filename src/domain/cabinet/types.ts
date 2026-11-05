import type { Front, Boundary, HorizontalRange } from '../fronts/types'

export interface Shelf extends HorizontalRange {
  id: string
  /** Absolute bottom face, in integer mm from the module's outside bottom. */
  bottom: number
}

/** A full-depth panel confined to one shelf-to-shelf opening. */
export interface Divider {
  id: string
  /** Absolute left face from the module's outside left, in integer mm. */
  left: number
  bottomBoundary: Boundary
  topBoundary: Boundary
}

/** Dimensions are outside dimensions in integer millimetres. */
export interface CabinetModule {
  id: string
  name: string
  width: number
  height: number
  depth: number
  shelves: Shelf[]
  dividers: Divider[]
  fronts: Front[]
}
