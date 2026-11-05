import type { Project } from '../domain/project/types'
import { spacesForRange } from '../domain/spaces/spaceRanges'
import { spaceRange } from '../domain/spaces/spaceRanges'
import type { BoundaryRange } from '../domain/commands/core'
import type { Selection } from './types'

export function spacesInRange(
  project: Project,
  moduleId: string,
  range: BoundaryRange,
) {
  const module = project.modules.find((item) => item.id === moduleId)
  return module ? spacesForRange(module, project.settings, range) : []
}
export function selectedSpaces(project: Project, selection: Selection) {
  if (selection?.type !== 'space') return []
  const ranges = selection.ranges ?? [selection.range]
  return ranges.flatMap((range) =>
    spacesInRange(project, selection.moduleId, range),
  )
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
    selection.type === 'divider' &&
    !module.dividers.some((item) => item.id === selection.dividerId)
  )
    return null
  if (
    selection.type === 'front' &&
    !module.fronts.some((item) => item.id === selection.frontId)
  )
    return null
  if (selection.type === 'space') {
    const signature = (project: Project) =>
      selectedSpaces(project, selection).map(spaceRange)
    const next = signature(after)
    if (
      !next.length ||
      JSON.stringify(signature(before)) !== JSON.stringify(next)
    )
      return null
  }
  return selection
}
