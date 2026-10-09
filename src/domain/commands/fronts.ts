import type { IdGenerator } from '../project/id'
import type { Project } from '../project/types'
import {
  allocateIds,
  type BoundaryRange,
  CommandError,
  editProject,
  findModule,
  leaves,
} from './core'

/** Endpoints select the entire contiguous structural range between them. */
export function addDoor(
  project: Project,
  moduleId: string,
  range: BoundaryRange,
  leafCount: 1 | 2 = 1,
  generateId?: IdGenerator,
): Project {
  leaves(leafCount)
  const id = allocateIds(project, generateId)
  return editProject(project, (draft) => {
    findModule(draft, moduleId).fronts.push({
      id: id(),
      type: 'door',
      leaves: leafCount,
      bottomBoundary: { ...range.bottomBoundary },
      topBoundary: { ...range.topBoundary },
    })
  })
}

export function addDrawerFront(
  project: Project,
  moduleId: string,
  range: BoundaryRange,
  generateId?: IdGenerator,
): Project {
  const id = allocateIds(project, generateId)
  return editProject(project, (draft) => {
    findModule(draft, moduleId).fronts.push({
      id: id(),
      type: 'drawer',
      bottomBoundary: { ...range.bottomBoundary },
      topBoundary: { ...range.topBoundary },
    })
  })
}

export function setDoorLeaves(
  project: Project,
  moduleId: string,
  frontId: string,
  leafCount: 1 | 2,
): Project {
  leaves(leafCount)
  return editProject(project, (draft) => {
    const front = findModule(draft, moduleId).fronts.find(
      (item) => item.id === frontId,
    )
    if (!front) throw new CommandError('front-not-found', { frontId })
    if (front.type !== 'door') throw new CommandError('not-a-door', { frontId })
    front.leaves = leafCount
  })
}

export function removeFront(
  project: Project,
  moduleId: string,
  frontId: string,
): Project {
  return editProject(project, (draft) => {
    const module = findModule(draft, moduleId)
    if (!module.fronts.some((front) => front.id === frontId))
      throw new CommandError('front-not-found', { frontId })
    module.fronts = module.fronts.filter((front) => front.id !== frontId)
  })
}
