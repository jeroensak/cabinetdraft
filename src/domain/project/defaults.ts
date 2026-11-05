import { inches } from './units'

/** Outside dimensions for the initial example and new empty modules, in mm. */
export const DEFAULT_MODULE_DIMENSIONS = {
  width: 800,
  height: 2200,
  depth: 600,
} as const

/** The same role for inch designs: 32" × 84" × 24". */
export const DEFAULT_INCH_MODULE_DIMENSIONS = {
  width: inches(32),
  height: inches(84),
  depth: inches(24),
} as const
