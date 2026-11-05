import { rangeBounds } from '../spaces/spaceRanges'
import type { IdGenerator } from '../project/id'
import type { Project } from '../project/types'
import { deriveSpaces } from '../spaces/deriveSpaces'
import { sameSpace, leftBoundary, rightBoundary } from '../spaces/boundaries'
import type { SpaceRange } from '../fronts/types'
import {
  allocateIds,
  CommandError,
  editProject,
  findModule,
  integer,
} from './core'

/** Place a full-depth divider at the centre of the selected space. */
export function addDividerToSpace(
  project: Project,
  moduleId: string,
  range: SpaceRange,
  generateId?: IdGenerator,
): Project {
  const id = allocateIds(project, generateId)
  return editProject(project, (draft) => {
    const module = findModule(draft, moduleId)
    const space = deriveSpaces(module, draft.settings).find((candidate) =>
      sameSpace(candidate, range),
    )
    if (!space) throw new CommandError('invalid-slot', { range })
    const left =
      space.left +
      Math.round((space.width - draft.settings.corpusThickness) / 2)
    if (
      space.width - draft.settings.corpusThickness < 2 ||
      !Number.isSafeInteger(left)
    )
      throw new CommandError('slot-too-narrow', { width: space.width })
    const dividerId = id()
    module.dividers.push({
      id: dividerId,
      left,
      bottomBoundary: { ...space.bottomBoundary },
      topBoundary: { ...space.topBoundary },
    })
    const box = rangeBounds(module, draft.settings, space)
    const drawer = module.fronts.find((front) => {
      const b = rangeBounds(module, draft.settings, front)
      return (
        front.type === 'drawer' &&
        b.left === box.left &&
        b.right === box.right &&
        b.bottom === box.bottom &&
        b.top === box.top
      )
    })
    if (drawer) {
      const boundary = { type: 'divider' as const, dividerId }
      module.fronts.splice(
        module.fronts.indexOf(drawer),
        1,
        { ...drawer, id: id(), rightBoundary: boundary },
        { ...drawer, id: id(), leftBoundary: boundary },
      )
    }
  })
}

/** Like shelf moves, geometric invalidity may remain for explicit repair. */
export function moveDivider(
  project: Project,
  moduleId: string,
  dividerId: string,
  left: number,
): Project {
  integer(left, 'left')
  return editProject(project, (draft) => {
    const divider = findModule(draft, moduleId).dividers.find(
      (item) => item.id === dividerId,
    )
    if (!divider) throw new CommandError('divider-not-found', { dividerId })
    divider.left = left
  })
}

export function removeDivider(
  project: Project,
  moduleId: string,
  dividerId: string,
): Project {
  return editProject(project, (draft) => {
    const module = findModule(draft, moduleId)
    if (!module.dividers.some((divider) => divider.id === dividerId))
      throw new CommandError('divider-not-found', { dividerId })
    if (
      [...module.shelves, ...module.fronts].some((item) =>
        [leftBoundary(item), rightBoundary(item)].some(
          (b) => b.type === 'divider' && b.dividerId === dividerId,
        ),
      )
    )
      throw new CommandError('divider-in-use', { dividerId })
    module.dividers = module.dividers.filter(
      (divider) => divider.id !== dividerId,
    )
  })
}
