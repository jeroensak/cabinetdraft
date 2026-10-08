import type { Front } from '../fronts/types'

export interface Shelf {
  id: string
  /** Absolute bottom face, in integer mm from the module's outside bottom. */
  bottom: number
}

/** Dimensions are outside dimensions in integer millimetres. */
export interface CabinetModule {
  id: string
  name: string
  width: number
  height: number
  depth: number
  shelves: Shelf[]
  fronts: Front[]
}
