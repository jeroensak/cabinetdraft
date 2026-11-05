import type { CabinetModule } from '../cabinet/types'
import type { SpaceRange } from '../fronts/types'
import type { ProjectSettings } from '../project/types'
import {
  horizontalBounds,
  verticalBounds,
  leftBoundary,
  rightBoundary,
  sameBoundary,
  sameHorizontalRange,
} from './boundaries'

/** A physical opening, derived from stable panel references; never persisted. */
export interface Space extends SpaceRange {
  left: number
  right: number
  width: number
  bottom: number
  top: number
  height: number
}
const sized = (space: Omit<Space, 'width' | 'height'>): Space => ({
  ...space,
  width: space.right - space.left,
  height: space.top - space.bottom,
})

/** Resolve supporting panels before their dependants. Invalid sizes remain raw. */
export function deriveSpacePartition(
  module: CabinetModule,
  settings: ProjectSettings,
) {
  const thickness = settings.corpusThickness
  let spaces: Space[] = [
    sized({
      bottomBoundary: { type: 'module-bottom' },
      topBoundary: { type: 'module-top' },
      leftBoundary: { type: 'module-left' },
      rightBoundary: { type: 'module-right' },
      ...horizontalBounds(module, settings, {}),
      ...verticalBounds(module, settings, {
        bottomBoundary: { type: 'module-bottom' },
        topBoundary: { type: 'module-top' },
      }),
    }),
  ]
  const pending = [
    ...[...module.shelves]
      .sort((a, b) => a.bottom - b.bottom)
      .map((shelf) => ({ type: 'shelf' as const, panel: shelf })),
    ...[...module.dividers]
      .sort((a, b) => a.left - b.left)
      .map((divider) => ({ type: 'divider' as const, panel: divider })),
  ]
  const resolved = new Set<string>()
  let progress = true
  while (pending.length && progress) {
    progress = false
    for (let index = 0; index < pending.length;) {
      const task = pending[index]
      const dependencies =
        task.type === 'shelf'
          ? [leftBoundary(task.panel), rightBoundary(task.panel)].flatMap(
              (b) => (b.type === 'divider' ? [b.dividerId] : []),
            )
          : [task.panel.bottomBoundary, task.panel.topBoundary].flatMap((b) =>
              b.type === 'shelf' ? [b.shelfId] : [],
            )
      if (dependencies.some((id) => !resolved.has(id))) {
        index++
        continue
      }
      if (task.type === 'shelf') {
        const shelf = task.panel
        const candidates = spaces
          .filter((s) => sameHorizontalRange(s, shelf))
          .sort((a, b) => a.bottom - b.bottom)
        // A shelf outside its opening still derives a negative space for validation.
        const target =
          candidates.findLast((s) => {
            const boundary = s.bottomBoundary
            const lower =
              boundary.type === 'shelf'
                ? module.shelves.find((p) => p.id === boundary.shelfId)?.bottom
                : -Infinity
            return shelf.bottom >= (lower ?? -Infinity)
          }) ?? candidates[0]
        if (!target) {
          index++
          continue
        }
        const bounds = horizontalBounds(module, settings, shelf)
        const boundary = { type: 'shelf' as const, shelfId: shelf.id }
        spaces = spaces.flatMap((s) =>
          s === target
            ? [
                sized({
                  ...s,
                  ...bounds,
                  top: shelf.bottom,
                  topBoundary: boundary,
                }),
                sized({
                  ...s,
                  ...bounds,
                  bottom: shelf.bottom + thickness,
                  bottomBoundary: boundary,
                }),
              ]
            : [s],
        )
      } else {
        const divider = task.panel
        const candidates = spaces
          .filter(
            (s) =>
              sameBoundary(s.bottomBoundary, divider.bottomBoundary) &&
              sameBoundary(s.topBoundary, divider.topBoundary),
          )
          .sort((a, b) => a.left - b.left)
        const target =
          candidates.findLast((s) => divider.left >= s.left - thickness) ??
          candidates[0]
        if (!target) {
          index++
          continue
        }
        const boundary = { type: 'divider' as const, dividerId: divider.id }
        spaces = spaces.flatMap((s) =>
          s === target
            ? [
                sized({ ...s, right: divider.left, rightBoundary: boundary }),
                sized({
                  ...s,
                  left: divider.left + thickness,
                  leftBoundary: boundary,
                }),
              ]
            : [s],
        )
      }
      resolved.add(task.panel.id)
      pending.splice(index, 1)
      progress = true
    }
  }
  return {
    spaces: module.dividers.length
      ? spaces.sort((a, b) => a.bottom - b.bottom || a.left - b.left)
      : spaces,
    unresolved: pending.map((task) => task.panel.id),
  }
}
export function deriveSpaces(
  module: CabinetModule,
  settings: ProjectSettings,
): Space[] {
  return deriveSpacePartition(module, settings).spaces
}
