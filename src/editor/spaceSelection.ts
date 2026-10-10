import type { Project } from '../domain/project/types'
import type { Space } from '../domain/spaces/deriveSpaces'
import { deriveSpaces } from '../domain/spaces/deriveSpaces'
import { sameBoundary } from '../domain/commands/core'
import type { Selection } from '../store/types'
import { spacesInRange } from '../store/selection'

/** Shift selection extends by one adjacent space; it never skips a gap. */
export function selectSpace(
  project: Project,
  moduleId: string,
  space: Space,
  selection: Selection,
  extend: boolean,
): Selection {
  const single: Selection = {
    type: 'space',
    moduleId,
    range: {
      bottomBoundary: space.bottomBoundary,
      topBoundary: space.topBoundary,
    },
  }
  if (!extend || selection?.type !== 'space' || selection.moduleId !== moduleId)
    return single
  const module = project.modules.find((item) => item.id === moduleId)!
  const all = deriveSpaces(module, project.settings)
  const selected = spacesInRange(project, moduleId, selection.range)
  if (!selected.length) return single
  const index = (item: Space) =>
    all.findIndex((candidate) =>
      sameBoundary(candidate.bottomBoundary, item.bottomBoundary),
    )
  const start = index(selected[0]),
    end = index(selected.at(-1)!),
    clicked = index(space)
  if (clicked < start - 1 || clicked > end + 1) return selection
  return {
    type: 'space',
    moduleId,
    range: {
      bottomBoundary: all[Math.min(start, clicked)].bottomBoundary,
      topBoundary: all[Math.max(end, clicked)].topBoundary,
    },
  }
}
