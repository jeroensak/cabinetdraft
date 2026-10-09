import type { BoundaryRange } from '../domain/commands'

export interface Point {
  x: number
  y: number
}

export type Selection =
  | { type: 'module'; moduleId: string }
  | { type: 'shelf'; moduleId: string; shelfId: string }
  | { type: 'space'; moduleId: string; range: BoundaryRange }
  | { type: 'front'; moduleId: string; frontId: string }
  | null
