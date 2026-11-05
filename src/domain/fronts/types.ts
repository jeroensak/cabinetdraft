/** Stable structural references, never derived space IDs or coordinates. */
export type Boundary =
  | { type: 'module-bottom' }
  | { type: 'shelf'; shelfId: string }
  | { type: 'module-top' }

export type HorizontalBoundary =
  | { type: 'module-left' }
  | { type: 'divider'; dividerId: string }
  | { type: 'module-right' }

/** Omitted horizontal references mean the outside module sides (legacy projects). */
export interface HorizontalRange {
  leftBoundary?: HorizontalBoundary
  rightBoundary?: HorizontalBoundary
}

export interface SpaceRange extends HorizontalRange {
  bottomBoundary: Boundary
  topBoundary: Boundary
}

/** One semantic door spanning one or more contiguous spaces. */
export interface DoorFront extends HorizontalRange {
  id: string
  type: 'door'
  bottomBoundary: Boundary
  topBoundary: Boundary
  leaves: 1 | 2
}

/** A visible drawer front covering exactly one space; no drawer box. */
export interface DrawerFront extends HorizontalRange {
  id: string
  type: 'drawer'
  bottomBoundary: Boundary
  topBoundary: Boundary
}

export type Front = DoorFront | DrawerFront
