import type { CabinetModule } from '../cabinet/types'
import type { Boundary, Front } from '../fronts/types'
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
  | 'not-a-door'
  | 'invalid-integer'
  | 'invalid-leaves'
  | 'invalid-module-order'
  | 'invalid-space'
  | 'non-integer-shelf-position'
  | 'id-conflict'
  | 'structural-conflict'

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

export type BoundaryRange = Pick<Front, 'bottomBoundary' | 'topBoundary'>

export function sameBoundary(a: Boundary, b: Boundary): boolean {
  return (
    a.type === b.type &&
    (a.type !== 'shelf' || (b.type === 'shelf' && a.shelfId === b.shelfId))
  )
}

export function cloneModule(module: CabinetModule): CabinetModule {
  return {
    ...module,
    shelves: module.shelves.map((shelf) => ({ ...shelf })),
    fronts: module.fronts.map((front) => ({
      ...front,
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
    ...project.modules.flatMap((module) => [
      module.id,
      ...module.shelves.map((shelf) => shelf.id),
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
