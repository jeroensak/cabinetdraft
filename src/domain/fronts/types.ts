/** Stable structural references, never derived space IDs or coordinates. */
export type Boundary =
  | { type: 'module-bottom' }
  | { type: 'shelf'; shelfId: string }
  | { type: 'module-top' }

/** One semantic door spanning one or more contiguous spaces. */
export interface DoorFront {
  id: string
  type: 'door'
  bottomBoundary: Boundary
  topBoundary: Boundary
  leaves: 1 | 2
}

/** A visible drawer front covering exactly one space; no drawer box. */
export interface DrawerFront {
  id: string
  type: 'drawer'
  bottomBoundary: Boundary
  topBoundary: Boundary
}

export type Front = DoorFront | DrawerFront
