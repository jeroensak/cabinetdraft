/** Module-local physical coordinates in mm: x right, y up, z backward.
 * The origin is the module's outside bottom-left-front corner, not an SVG point.
 */
export interface PhysicalPosition {
  x: number
  y: number
  z: number
}

export type PanelSource =
  | { type: 'side-left' | 'side-right' | 'top' | 'bottom' | 'back' }
  | { type: 'shelf'; shelfId: string }
  | { type: 'door'; frontId: string; leaf: 'single' | 'left' | 'right' }
  | { type: 'drawer'; frontId: string }

/** Maps manufacturing dimensions onto physical axes without duplicating sizes.
 * side: length=y, width=z, thickness=x
 * horizontal: length=x, width=z, thickness=y
 * face: length=y, width=x, thickness=z
 */
export type PanelOrientation = 'side' | 'horizontal' | 'face'

/** Derived only. Each entry represents one physical panel, never a grouped part. */
export interface PhysicalPanel {
  moduleId: string
  source: PanelSource
  length: number
  width: number
  thickness: number
  orientation: PanelOrientation
  /** Minimum corner; extents follow orientation and manufacturing dimensions. */
  position: PhysicalPosition
}
