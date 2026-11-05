import type { Project } from '../domain/project/types'
import type { Space } from '../domain/spaces/deriveSpaces'
import { sameSpace } from '../domain/spaces/boundaries'
import {
  enclosingRange,
  rangeBounds,
  spaceRange,
} from '../domain/spaces/spaceRanges'
import type { Selection } from '../store/types'
import { selectedSpaces } from '../store/selection'

/** Shift adds an edge-adjacent opening; L-shaped groups support per-space actions. */
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
    range: spaceRange(space),
  }
  if (!extend || selection?.type !== 'space' || selection.moduleId !== moduleId)
    return single
  const module = project.modules.find((item) => item.id === moduleId)!
  const selected = selectedSpaces(project, selection)
  if (!selected.length) return single
  if (selected.some((s) => sameSpace(s, space))) return selection
  const b = rangeBounds(module, project.settings, space)
  const adjacent = selected.some((s) => {
    const a = rangeBounds(module, project.settings, s)
    return (
      ((a.left === b.right || a.right === b.left) &&
        a.bottom < b.top &&
        a.top > b.bottom) ||
      ((a.top === b.bottom || a.bottom === b.top) &&
        a.left < b.right &&
        a.right > b.left)
    )
  })
  if (!adjacent) return selection
  const combined = [...selected, space]
  const range = enclosingRange(module, project.settings, combined)
  return {
    type: 'space',
    moduleId,
    range: range ?? selection.range,
    ...(range ? {} : { ranges: combined.map(spaceRange) }),
  }
}
