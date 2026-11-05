import type { BoundaryRange } from '../domain/commands'

export interface Point {
  x: number
  y: number
}

export type Selection =
  | { type: 'module'; moduleId: string }
  | { type: 'shelf'; moduleId: string; shelfId: string }
  | { type: 'divider'; moduleId: string; dividerId: string }
  | {
      type: 'space'
      moduleId: string
      range: BoundaryRange
      ranges?: BoundaryRange[]
    }
  | { type: 'front'; moduleId: string; frontId: string }
  | null
