import { copyHorizontalRange } from '../spaces/boundaries'
import type { CabinetModule } from '../cabinet/types'
import type { SpaceRange } from '../fronts/types'
import { createId, type IdGenerator } from '../project/id'
import type { Project } from '../project/types'
import {
  validateProject,
  type ValidationCode,
} from '../validation/validateProject'

export type CommandErrorCode =
  | 'module-not-found'
  | 'shelf-not-found'
  | 'front-not-found'
  | 'divider-not-found'
  | 'not-a-door'
  | 'invalid-integer'
  | 'invalid-leaves'
  | 'invalid-module-order'
  | 'invalid-space'
  | 'invalid-slot'
  | 'slot-too-narrow'
  | 'shelf-has-dividers'
  | 'divider-in-use'
  | 'non-integer-shelf-position'
  | 'id-conflict'
  | 'structural-conflict'
  | 'drawer-design-not-found'
  | 'invalid-drawer-design'
  | 'drawer-design-in-use'
  | 'drawer-does-not-fit'
  | 'space-occupied'
  | 'not-a-drawer'

export class CommandError extends Error {
  readonly code: CommandErrorCode
  readonly data: Record<string, unknown>

  constructor(code: CommandErrorCode, data: Record<string, unknown> = {}) {
    super(code)
    this.name = 'CommandError'
    this.code = code
    this.data = data
  }
}

export type BoundaryRange = SpaceRange

export { sameBoundary } from '../spaces/boundaries'

export function cloneModule(module: CabinetModule): CabinetModule {
  return {
    ...module,
    shelves: module.shelves.map((shelf) => ({
      ...shelf,
      ...copyHorizontalRange(shelf),
    })),
    dividers: module.dividers.map((divider) => ({
      ...divider,
      bottomBoundary: { ...divider.bottomBoundary },
      topBoundary: { ...divider.topBoundary },
    })),
    fronts: module.fronts.map((front) => ({
      ...front,
      ...copyHorizontalRange(front),
      bottomBoundary: { ...front.bottomBoundary },
      topBoundary: { ...front.topBoundary },
    })),
  }
}

const structuralCodes = new Set<ValidationCode>([
  'duplicate-id',
  'missing-front-boundary',
  'invalid-front-range',
  'drawer-must-cover-one-space',
  'overlapping-fronts',
  'invalid-divider-range',
  'invalid-shelf-range',
  'missing-front-divider',
  'cyclic-panel-reference',
  'missing-drawer-design',
])

/** Mutate a private copy and publish it only if structural invariants hold.
 * Geometric validation issues deliberately do not prevent a command commit.
 */
export function editProject(
  project: Project,
  edit: (draft: Project) => void,
): Project {
  const draft: Project = {
    ...project,
    settings: { ...project.settings },
    drawerDesigns: project.drawerDesigns.map((design) => ({ ...design })),
    modules: project.modules.map(cloneModule),
  }
  edit(draft)
  const issues = validateProject(draft).filter((issue) =>
    structuralCodes.has(issue.code),
  )
  if (issues.length) throw new CommandError('structural-conflict', { issues })
  return draft
}

export function findModule(project: Project, moduleId: string): CabinetModule {
  const module = project.modules.find((item) => item.id === moduleId)
  if (!module) throw new CommandError('module-not-found', { moduleId })
  return module
}

export function integer(value: number, field: string): void {
  if (!Number.isSafeInteger(value))
    throw new CommandError('invalid-integer', { field, value })
}

export function leaves(value: number): asserts value is 1 | 2 {
  if (value !== 1 && value !== 2)
    throw new CommandError('invalid-leaves', { value })
}

/** Reserves IDs within a command as well as against the entire input project. */
export function allocateIds(
  project: Project,
  generateId: IdGenerator = createId,
): IdGenerator {
  const used = new Set([
    project.id,
    ...project.drawerDesigns.map((design) => design.id),
    ...project.modules.flatMap((module) => [
      module.id,
      ...module.shelves.map((shelf) => shelf.id),
      ...module.dividers.map((divider) => divider.id),
      ...module.fronts.map((front) => front.id),
    ]),
  ])
  return () => {
    const id = generateId()
    if (!id || used.has(id)) throw new CommandError('id-conflict', { id })
    used.add(id)
    return id
  }
}
