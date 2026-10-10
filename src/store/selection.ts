import type { Project } from '../domain/project/types'
import { deriveSpaces } from '../domain/spaces/deriveSpaces'
import { sameBoundary, type BoundaryRange } from '../domain/commands/core'
import type { Selection } from './types'

export function spacesInRange(
  project: Project,
  moduleId: string,
  range: BoundaryRange,
) {
  const module = project.modules.find((item) => item.id === moduleId)
  if (!module) return []
  const spaces = deriveSpaces(module, project.settings)
  const start = spaces.findIndex((space) =>
    sameBoundary(space.bottomBoundary, range.bottomBoundary),
  )
  const end = spaces.findIndex((space) =>
    sameBoundary(space.topBoundary, range.topBoundary),
  )
  return start >= 0 && end >= start ? spaces.slice(start, end + 1) : []
}

export function reconcileSelection(
  before: Project,
  after: Project,
  selection: Selection,
): Selection {
  if (!selection) return null
  const module = after.modules.find((item) => item.id === selection.moduleId)
  if (!module) return null
  if (
    selection.type === 'shelf' &&
    !module.shelves.some((item) => item.id === selection.shelfId)
  )
    return null
  if (
    selection.type === 'front' &&
    !module.fronts.some((item) => item.id === selection.frontId)
  )
    return null
  if (selection.type === 'space') {
    const signature = (project: Project) =>
      spacesInRange(project, module.id, selection.range).map(
        ({ bottomBoundary, topBoundary }) => ({ bottomBoundary, topBoundary }),
      )
    const next = signature(after)
    if (
      !next.length ||
      JSON.stringify(signature(before)) !== JSON.stringify(next)
    )
      return null
  }
  return selection
}
