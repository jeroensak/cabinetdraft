import { expect } from 'vitest'
import { createDefaultProject } from '../project/createDefaultProject'
import type { IdGenerator } from '../project/id'
import type { Project } from '../project/types'
import { horizontalData } from '../spaces/boundaries'
import {
  allocateIds,
  type BoundaryRange,
  CommandError,
  type CommandErrorCode,
  editProject,
  findModule,
} from './core'

export function ids(prefix = 'new') {
  let next = 0
  return () => `${prefix}-${++next}`
}

export function fixture(empty = false): Project {
  const project = createDefaultProject(ids('original'))
  if (empty) {
    project.modules[0]!.shelves = []
    project.modules[0]!.fronts = []
  }
  return project
}

export const fullRange = {
  bottomBoundary: { type: 'module-bottom' as const },
  topBoundary: { type: 'module-top' as const },
}

export function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.freeze(value)
    for (const child of Object.values(value)) freeze(child)
  }
  return value
}

export function rejects(
  project: Project,
  action: () => unknown,
  code: CommandErrorCode,
) {
  const before = structuredClone(project)
  freeze(project)
  expect(action).toThrowError(
    expect.objectContaining({ name: 'CommandError', code }),
  )
  expect(project).toStrictEqual(before)
}

export function structuralCodes(action: () => unknown): string[] {
  try {
    action()
  } catch (error) {
    if (error instanceof CommandError && error.code === 'structural-conflict') {
      return (error.data.issues as { code: string }[]).map(
        (issue) => issue.code,
      )
    }
    throw error
  }
  throw new Error('Expected structural failure')
}

/** Test setup for a drawer front's own geometry and structural rules. The app
 * always creates drawers through a design, so it has no equivalent command. */
export function addBoxlessFront(
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
      ...horizontalData(range),
      bottomBoundary: { ...range.bottomBoundary },
      topBoundary: { ...range.topBoundary },
    })
  })
}
