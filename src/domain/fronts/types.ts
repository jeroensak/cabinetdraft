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

export type FrontMount = 'overlay' | 'inset'

/** One semantic door spanning one or more contiguous spaces. */
export interface DoorFront extends HorizontalRange {
  id: string
  type: 'door'
  bottomBoundary: Boundary
  topBoundary: Boundary
  leaves: 1 | 2
  /** Omitted means overlay. */
  mount?: FrontMount
}

/** A front covering one space, optionally linked to a reusable drawer box design. */
export interface DrawerFront extends HorizontalRange {
  id: string
  type: 'drawer'
  drawerDesignId?: string
  bottomBoundary: Boundary
  topBoundary: Boundary
}

export type Front = DoorFront | DrawerFront
