// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { addModule, moveShelf, setModuleDimensions } from '../domain/commands'
import { createDefaultProject } from '../domain/project/createDefaultProject'
import {
  PROJECT_STORAGE_KEY,
  createProjectStore,
  installHistoryShortcuts,
  type ProjectStorage,
} from './projectStore'

function memoryStorage(
  initial: string | null = null,
): ProjectStorage & { value: string | null; writes: string[]; keys: string[] } {
  return {
    value: initial,
    writes: [],
    keys: [],
    getItem() {
      return this.value
    },
    setItem(key, value) {
      this.keys.push(key)
      this.value = value
      this.writes.push(value)
    },
  }
}
function expectDefaultShape(project: ReturnType<typeof createDefaultProject>) {
  expect(project).toMatchObject({
    schemaVersion: 1,
    name: 'Untitled cabinet',
    settings: {
      corpusThickness: 18,
      backPanelEnabled: true,
      backPanelThickness: 3,
      frontThickness: 18,
      frontGap: 2,
    },
    modules: [
      {
        name: 'Cabinet 1',
        width: 800,
        height: 2200,
        depth: 600,
        shelves: [{ bottom: 1091 }],
        fronts: [
          {
            type: 'door',
            leaves: 2,
            bottomBoundary: { type: 'module-bottom' },
            topBoundary: { type: 'module-top' },
          },
        ],
      },
    ],
  })
  const cabinet = project.modules[0]!
  expect(
    [
      project.id,
      cabinet.id,
      cabinet.shelves[0]!.id,
      cabinet.fronts[0]!.id,
    ].every((id) => typeof id === 'string' && id.length > 0),
  ).toBe(true)
}
function ids() {
  let next = 0
  return () => `generated-${++next}`
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('project store and local persistence', () => {
  it('starts with a fresh default project when storage is empty', () => {
    const storage = memoryStorage()
    const store = createProjectStore({ storage })
    expectDefaultShape(store.getState().present)
    expect(store.getState().past).toStrictEqual([])
    expect(store.getState().future).toStrictEqual([])
    expect(storage.writes).toStrictEqual([])
  })

  it('restores the exact project JSON, including representable invalid geometry', () => {
    const project = createDefaultProject(ids())
    project.modules[0]!.height = 800
    const storage = memoryStorage(JSON.stringify(project))
    const store = createProjectStore({ storage })
    expect(store.getState().present).toStrictEqual(project)
    expect(store.getState().past).toStrictEqual([])
    expect(storage.writes).toStrictEqual([])
  })

  it.each([
    '{',
    'null',
    '[]',
    JSON.stringify({ schemaVersion: 2 }),
    JSON.stringify({ schemaVersion: 1, id: 'p', modules: [] }),
  ])('falls back safely for unreadable persisted project %s', (raw) => {
    const store = createProjectStore({ storage: memoryStorage(raw) })
    expectDefaultShape(store.getState().present)
  })

  it('records one history entry and autosaves only the Project JSON for one command', () => {
    const storage = memoryStorage()
    const store = createProjectStore({ storage })
    const result = addModule(store.getState().present, ids())
    store.getState().execute(() => result)
    expect(store.getState().past).toHaveLength(1)
    expect(store.getState().future).toStrictEqual([])
    expect(storage.writes).toHaveLength(1)
    expect(storage.keys).toStrictEqual([PROJECT_STORAGE_KEY])
    expect(storage.value).toBe(JSON.stringify(result))
    expect(JSON.parse(storage.value!)).toStrictEqual(result)
    expect(JSON.parse(storage.value!)).not.toHaveProperty('past')
    expect(JSON.parse(storage.value!)).not.toHaveProperty('editor')
  })

  it('undoes and redoes project changes, persisting the current project each time', () => {
    const storage = memoryStorage()
    const store = createProjectStore({ storage })
    const original = store.getState().present
    store.getState().execute((project) => addModule(project, ids()))
    const edited = store.getState().present
    store.getState().undo()
    expect(store.getState().present).toStrictEqual(original)
    expect(store.getState().past).toStrictEqual([])
    expect(store.getState().future).toStrictEqual([edited])
    expect(storage.value).toBe(JSON.stringify(original))
    store.getState().redo()
    expect(store.getState().present).toStrictEqual(edited)
    expect(store.getState().future).toStrictEqual([])
    expect(storage.value).toBe(JSON.stringify(edited))
    expect(storage.writes).toHaveLength(3)
  })

  it('clears redo history when a new project command follows undo', () => {
    const store = createProjectStore({ storage: memoryStorage() })
    store.getState().execute((project) => addModule(project, ids()))
    store.getState().undo()
    store
      .getState()
      .execute((project) =>
        setModuleDimensions(project, project.modules[0]!.id, { width: 900 }),
      )
    expect(store.getState().future).toStrictEqual([])
    expect(store.getState().past).toHaveLength(1)
  })

  it('does not add history or write storage for a no-op project command', () => {
    const storage = memoryStorage()
    const store = createProjectStore({ storage })
    store.getState().execute((project) => project)
    expect(store.getState().past).toStrictEqual([])
    expect(storage.writes).toStrictEqual([])
  })

  it('keeps selection, hover, zoom and pan editor-only and out of history/storage', () => {
    const storage = memoryStorage()
    const store = createProjectStore({ storage })
    const range = {
      bottomBoundary: { type: 'module-bottom' as const },
      topBoundary: { type: 'module-top' as const },
    }
    const selection = {
      type: 'space' as const,
      moduleId: store.getState().present.modules[0]!.id,
      range,
    }
    store.getState().setSelection(selection)
    store.getState().setHover({ type: 'module', moduleId: selection.moduleId })
    store.getState().setViewport({ zoom: 2, pan: { x: 30, y: -12 } })
    expect(store.getState().editor).toStrictEqual({
      selection,
      hover: { type: 'module', moduleId: selection.moduleId },
      viewport: { zoom: 2, pan: { x: 30, y: -12 } },
      viewportProjectId: store.getState().present.id,
      viewportModuleIds: store
        .getState()
        .present.modules.map((module) => module.id),
    })
    expect(store.getState().past).toStrictEqual([])
    expect(storage.writes).toStrictEqual([])
  })

  it('previews a shelf drag live, then records and saves exactly one change on release', () => {
    const storage = memoryStorage()
    const store = createProjectStore({ storage })
    const original = store.getState().present
    const updated = setModuleDimensions(original, original.modules[0]!.id, {
      width: 900,
    })
    store.getState().beginProjectPreview()
    store.getState().updateProjectPreview(updated)
    expect(store.getState().present.modules[0]!.width).toBe(900)
    expect(store.getState().past).toStrictEqual([])
    expect(storage.writes).toStrictEqual([])
    store.getState().commitProjectPreview()
    expect(store.getState().past).toStrictEqual([original])
    expect(store.getState().future).toStrictEqual([])
    expect(storage.writes).toHaveLength(1)
    store.getState().undo()
    expect(store.getState().present).toStrictEqual(original)
  })

  it('cancels a preview without saving or creating history', () => {
    const storage = memoryStorage()
    const store = createProjectStore({ storage })
    const original = store.getState().present
    const updated = setModuleDimensions(original, original.modules[0]!.id, {
      width: 900,
    })
    store.getState().beginProjectPreview()
    store.getState().updateProjectPreview(updated)
    store.getState().cancelProjectPreview()
    expect(store.getState().present).toBe(original)
    expect(store.getState().past).toStrictEqual([])
    expect(storage.writes).toStrictEqual([])
  })

  it('undo during a preview cancels the in-progress preview first', () => {
    const store = createProjectStore({ storage: memoryStorage() })
    store.getState().execute((project) => addModule(project, ids()))
    const edited = store.getState().present
    const preview = setModuleDimensions(edited, edited.modules[0]!.id, {
      width: 900,
    })
    store.getState().beginProjectPreview()
    store.getState().updateProjectPreview(preview)
    store.getState().undo()
    expect(store.getState().present).toBe(edited)
    expect(store.getState().past).toHaveLength(1)
  })

  it('safely keeps the in-memory project when local storage writes fail', () => {
    const storage: ProjectStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota')
      },
    }
    const store = createProjectStore({ storage })
    expect(() =>
      store.getState().execute((project) => addModule(project, ids())),
    ).not.toThrow()
    expect(store.getState().present.modules).toHaveLength(2)
  })

  it('offers global Ctrl/Cmd+Z and Shift+Z shortcuts with cleanup', () => {
    const store = createProjectStore({ storage: memoryStorage() })
    store.getState().execute((project) => addModule(project, ids()))
    const target = new EventTarget()
    const undo = vi.spyOn(store.getState(), 'undo')
    const redo = vi.spyOn(store.getState(), 'redo')
    const dispose = installHistoryShortcuts(store, target)
    const undoEvent = new KeyboardEvent('keydown', {
      key: 'z',
      ctrlKey: true,
      cancelable: true,
    })
    target.dispatchEvent(undoEvent)
    expect(undoEvent.defaultPrevented).toBe(true)
    expect(undo).toHaveBeenCalledOnce()
    const redoEvent = new KeyboardEvent('keydown', {
      key: 'Z',
      metaKey: true,
      shiftKey: true,
      cancelable: true,
    })
    target.dispatchEvent(redoEvent)
    expect(redo).toHaveBeenCalledOnce()
    dispose()
    target.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'z',
        ctrlKey: true,
        cancelable: true,
      }),
    )
    expect(undo).toHaveBeenCalledOnce()
  })

  it('uses shelf movement previews as one history entry', () => {
    const store = createProjectStore({ storage: memoryStorage() })
    const project = store.getState().present
    const updated = moveShelf(
      project,
      project.modules[0]!.id,
      project.modules[0]!.shelves[0]!.id,
      1000,
    )
    store.getState().beginProjectPreview()
    store.getState().updateProjectPreview(updated)
    store.getState().commitProjectPreview()
    expect(store.getState().past).toHaveLength(1)
  })
})
