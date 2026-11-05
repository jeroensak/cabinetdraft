import { describe, expect, it } from 'vitest'
import { createDefaultProject } from '../domain/project/createDefaultProject'
import {
  addDividerToSpace,
  addShelfToSpace,
  addDrawerFront,
  addDoor,
} from '../domain/commands'
import { deriveSpaces } from '../domain/spaces/deriveSpaces'
import { enclosingRange } from '../domain/spaces/spaceRanges'
import { selectSpace } from './spaceSelection'
import { selectedSpaces } from '../store/selection'
import { createProjectStore } from '../store/projectStore'

function grid() {
  let p = createDefaultProject()
  p.modules[0].fronts = []
  p.modules[0].shelves = []
  const m = p.modules[0]
  p = addDividerToSpace(p, m.id, deriveSpaces(m, p.settings)[0])
  for (const space of deriveSpaces(p.modules[0], p.settings))
    p = addShelfToSpace(p, m.id, space)
  return p
}
describe('partitioned space selection', () => {
  it('grows from adjacent cells through an L shape into a rectangle without selecting a diagonal', () => {
    const p = grid(),
      m = p.modules[0],
      spaces = deriveSpaces(m, p.settings)
    const first = selectSpace(p, m.id, spaces[0], null, false)
    expect(selectSpace(p, m.id, spaces[3], first, true)).toEqual(first)
    const pair = selectSpace(p, m.id, spaces[1], first, true)
    const lShape = selectSpace(p, m.id, spaces[2], pair, true)
    expect(selectedSpaces(p, lShape)).toHaveLength(3)
    expect(enclosingRange(m, p.settings, selectedSpaces(p, lShape))).toBeNull()
    const rectangle = selectSpace(p, m.id, spaces[3], lShape, true)
    expect(selectedSpaces(p, rectangle)).toHaveLength(4)
    expect(enclosingRange(m, p.settings, selectedSpaces(p, rectangle))).toEqual(
      {
        bottomBoundary: { type: 'module-bottom' },
        topBoundary: { type: 'module-top' },
      },
    )
  })
  it('commits a multi-space edit once and rolls the whole edit back if a later space is occupied', () => {
    const p = grid(),
      m = p.modules[0],
      spaces = deriveSpaces(m, p.settings)
    const store = createProjectStore({
      storage: { getItem: () => JSON.stringify(p), setItem: () => {} },
    })
    store
      .getState()
      .execute((p) =>
        spaces.reduce((next, space) => addDrawerFront(next, m.id, space), p),
      )
    expect(store.getState().present.modules[0].fronts).toHaveLength(4)
    expect(store.getState().past).toHaveLength(1)
    store.getState().undo()
    expect(store.getState().present).toEqual(p)
    store.getState().execute((p) => addDoor(p, m.id, spaces[1]))
    const before = store.getState().present,
      history = store.getState().past
    expect(() =>
      store
        .getState()
        .execute((p) =>
          spaces.reduce((next, space) => addDrawerFront(next, m.id, space), p),
        ),
    ).toThrow('structural-conflict')
    expect(store.getState().present).toBe(before)
    expect(store.getState().past).toBe(history)
  })
})
