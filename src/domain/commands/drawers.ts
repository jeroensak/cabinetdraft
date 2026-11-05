import type { Project } from '../project/types'
import type { IdGenerator } from '../project/id'
import type { DrawerFront, SpaceRange } from '../fronts/types'
import { drawerDesignData, type DrawerDesignInput } from '../drawers/types'
import {
  deriveDrawerGeometry,
  validateDrawerDesign,
} from '../drawers/deriveDrawerGeometry'
import { deriveSpaces } from '../spaces/deriveSpaces'
import { sameSpace } from '../spaces/boundaries'
import { spaceRange, spacesForRange } from '../spaces/spaceRanges'
import {
  allocateIds,
  editProject,
  findModule,
  CommandError,
  integer,
} from './core'

const measurementFields = [
  'wallThickness',
  'bottomThickness',
  'depth',
  'sideClearance',
  'bottomClearance',
  'topClearance',
  'rearClearance',
  'bottomRecess',
] as const

/** Library entries are always internally consistent; fit is checked per space. */
function checkDesign(input: DrawerDesignInput) {
  for (const field of measurementFields) integer(input[field], field)
  integer(input.heightPercent, 'heightPercent')
  integer(input.frontHeightPercent, 'frontHeightPercent')
  const issues = validateDrawerDesign(input)
  if (issues.length) throw new CommandError('invalid-drawer-design', { issues })
}

/** Adds a reusable design; it is appended, so the new entry is last. */
export function addDrawerDesign(
  project: Project,
  input: DrawerDesignInput,
  generateId?: IdGenerator,
): Project {
  checkDesign(input)
  const id = allocateIds(project, generateId)
  return editProject(project, (draft) => {
    draft.drawerDesigns.push(drawerDesignData({ ...input, id: id() }))
  })
}

/** Every drawer using the design follows the change; fit may become invalid. */
export function updateDrawerDesign(
  project: Project,
  designId: string,
  input: DrawerDesignInput,
): Project {
  checkDesign(input)
  return editProject(project, (draft) => {
    const index = draft.drawerDesigns.findIndex((d) => d.id === designId)
    if (index < 0)
      throw new CommandError('drawer-design-not-found', { designId })
    draft.drawerDesigns[index] = drawerDesignData({ ...input, id: designId })
  })
}

export function drawerDesignUsage(project: Project, designId: string): number {
  return project.modules.reduce(
    (count, module) =>
      count +
      module.fronts.filter(
        (front) => front.type === 'drawer' && front.drawerDesignId === designId,
      ).length,
    0,
  )
}

/** Designs in use are never removed implicitly from their drawers. */
export function deleteDrawerDesign(
  project: Project,
  designId: string,
): Project {
  return editProject(project, (draft) => {
    if (!draft.drawerDesigns.some((d) => d.id === designId))
      throw new CommandError('drawer-design-not-found', { designId })
    if (drawerDesignUsage(draft, designId) > 0)
      throw new CommandError('drawer-design-in-use', { designId })
    draft.drawerDesigns = draft.drawerDesigns.filter((d) => d.id !== designId)
  })
}

export interface DrawerTarget {
  moduleId: string
  range: SpaceRange
}

/** One atomic edit across spaces. Existing drawer fronts keep their IDs and
 * gain/replace their box; empty spaces receive a new drawer front. Doors are
 * never replaced. Every target must fit, or nothing changes.
 */
export function applyDrawerDesign(
  project: Project,
  designId: string,
  targets: readonly DrawerTarget[],
  generateId?: IdGenerator,
): Project {
  const id = allocateIds(project, generateId)
  return editProject(project, (draft) => {
    const design = draft.drawerDesigns.find((d) => d.id === designId)
    if (!design) throw new CommandError('drawer-design-not-found', { designId })
    if (!targets.length) throw new CommandError('invalid-space')
    for (const [index, target] of targets.entries()) {
      if (
        targets
          .slice(0, index)
          .some(
            (t) =>
              t.moduleId === target.moduleId &&
              sameSpace(t.range, target.range),
          )
      )
        throw new CommandError('invalid-space', { range: target.range })
      const module = findModule(draft, target.moduleId)
      const space = deriveSpaces(module, draft.settings).find((s) =>
        sameSpace(s, target.range),
      )
      if (!space)
        throw new CommandError('invalid-space', { range: target.range })
      const occupant = module.fronts.find((f) =>
        spacesForRange(module, draft.settings, f).some((s) =>
          sameSpace(s, space),
        ),
      )
      if (occupant?.type === 'door')
        throw new CommandError('space-occupied', { frontId: occupant.id })
      const existing = occupant
      const front: DrawerFront = {
        id: existing?.id ?? id(),
        type: 'drawer',
        ...spaceRange(space),
        drawerDesignId: designId,
      }
      const geometry = deriveDrawerGeometry(
        module,
        draft.settings,
        front,
        design,
      )
      if (geometry.issues.length)
        throw new CommandError('drawer-does-not-fit', {
          issues: geometry.issues,
        })
      if (existing) module.fronts[module.fronts.indexOf(existing)] = front
      else module.fronts.push(front)
    }
  })
}

/** Keeps the drawer front; only the box link is removed. */
export function removeDrawerBox(
  project: Project,
  moduleId: string,
  frontId: string,
): Project {
  return editProject(project, (draft) => {
    const front = findModule(draft, moduleId).fronts.find(
      (f) => f.id === frontId,
    )
    if (!front) throw new CommandError('front-not-found', { frontId })
    if (front.type !== 'drawer')
      throw new CommandError('not-a-drawer', { frontId })
    delete front.drawerDesignId
  })
}
