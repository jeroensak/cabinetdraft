import type { CabinetModule } from '../cabinet/types'
import type { Front } from '../fronts/types'
import type { IdGenerator } from '../project/id'
import type { Project } from '../project/types'
import { deriveSpaces } from '../spaces/deriveSpaces'
import {
  allocateIds,
  type BoundaryRange,
  CommandError,
  editProject,
  findModule,
  integer,
  sameBoundary,
} from './core'

function occupant(
  module: CabinetModule,
  range: BoundaryRange,
): Front | undefined {
  const boundaries = [
    { type: 'module-bottom' as const },
    ...[...module.shelves]
      .sort((a, b) => a.bottom - b.bottom)
      .map((shelf) => ({ type: 'shelf' as const, shelfId: shelf.id })),
    { type: 'module-top' as const },
  ]
  const index = (boundary: BoundaryRange['bottomBoundary']) =>
    boundaries.findIndex((item) => sameBoundary(item, boundary))
  return module.fronts.find(
    (front) =>
      index(front.bottomBoundary) <= index(range.bottomBoundary) &&
      index(front.topBoundary) >= index(range.topBoundary),
  )
}

export function addShelfToSpace(
  project: Project,
  moduleId: string,
  range: BoundaryRange,
  generateId?: IdGenerator,
): Project {
  const id = allocateIds(project, generateId)
  return editProject(project, (draft) => {
    const module = findModule(draft, moduleId)
    const space = deriveSpaces(module, draft.settings).find(
      (space) =>
        sameBoundary(space.bottomBoundary, range.bottomBoundary) &&
        sameBoundary(space.topBoundary, range.topBoundary),
    )
    if (!space) throw new CommandError('invalid-space', { range })
    // Round placement only: half millimetres go toward the module top.
    const bottom = Math.round(
      space.bottom + (space.height - draft.settings.corpusThickness) / 2,
    )
    if (!Number.isSafeInteger(bottom))
      throw new CommandError('non-integer-shelf-position', { bottom })
    const front = occupant(module, space)
    const shelf = { id: id(), bottom }
    module.shelves.push(shelf)
    if (front?.type === 'drawer') {
      const boundary = { type: 'shelf' as const, shelfId: shelf.id }
      const index = module.fronts.indexOf(front)
      module.fronts.splice(
        index,
        1,
        { ...front, id: id(), topBoundary: { ...boundary } },
        { ...front, id: id(), bottomBoundary: { ...boundary } },
      )
    }
  })
}

export function moveShelf(
  project: Project,
  moduleId: string,
  shelfId: string,
  bottom: number,
): Project {
  integer(bottom, 'bottom')
  return editProject(project, (draft) => {
    const shelf = findModule(draft, moduleId).shelves.find(
      (item) => item.id === shelfId,
    )
    if (!shelf) throw new CommandError('shelf-not-found', { shelfId })
    shelf.bottom = bottom
  })
}

export function removeShelf(
  project: Project,
  moduleId: string,
  shelfId: string,
): Project {
  return editProject(project, (draft) => {
    const module = findModule(draft, moduleId)
    if (!module.shelves.some((shelf) => shelf.id === shelfId))
      throw new CommandError('shelf-not-found', { shelfId })
    const spaces = deriveSpaces(module, draft.settings)
    const boundary = { type: 'shelf' as const, shelfId }
    const lowerSpace = spaces.find((space) =>
      sameBoundary(space.topBoundary, boundary),
    )!
    const upperSpace = spaces.find((space) =>
      sameBoundary(space.bottomBoundary, boundary),
    )!
    const lower = occupant(module, lowerSpace)
    const upper = occupant(module, upperSpace)
    const winner = lower ?? upper
    const loser = lower && upper && lower !== upper ? upper : undefined
    if (loser) module.fronts = module.fronts.filter((front) => front !== loser)
    if (winner) {
      if (sameBoundary(winner.bottomBoundary, boundary))
        winner.bottomBoundary = { ...lowerSpace.bottomBoundary }
      if (sameBoundary(winner.topBoundary, boundary))
        winner.topBoundary = { ...upperSpace.topBoundary }
    }
    module.shelves = module.shelves.filter((shelf) => shelf.id !== shelfId)
  })
}
