// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createProjectStore, installHistoryShortcuts } from './projectStore'
import { createDefaultProject } from '../domain/project/createDefaultProject'
import { projectData } from '../domain/project/projectData'
import { renameProject, setModuleDimensions } from '../domain/commands'

function storage(initial: string | null = null) {
  return {
    value: initial,
    writes: 0,
    getItem() {
      return this.value
    },
    setItem(_key: string, value: string) {
      this.value = value
      this.writes++
    },
  }
}

it.each(['{unreadable', JSON.stringify({ schemaVersion: 99 })])(
  'preserves unreadable saved data through edits, undo, redo and retry: %s',
  (raw) => {
    const disk = storage(raw)
    const store = createProjectStore({ storage: disk })
    expect(store.getState().persistence).toMatchObject({
      loadError: 'invalid-project',
      recoveryData: raw,
    })
    store
      .getState()
      .execute((project) => renameProject(project, 'Working copy'))
    store.getState().undo()
    store.getState().redo()
    store.getState().retrySave()
    expect(store.getState().present.name).toBe('Working copy')
    expect(store.getState().persistence).toMatchObject({
      saveError: 'blocked-by-load-error',
      unsaved: true,
    })
    expect(disk.value).toBe(raw)
    expect(disk.writes).toBe(0)
  },
)

it('blocks writes when the original stored project cannot be read', () => {
  let writes = 0
  const store = createProjectStore({
    storage: {
      getItem: () => {
        throw new Error('unavailable')
      },
      setItem: () => {
        writes++
      },
    },
  })
  store.getState().execute((project) => renameProject(project, 'Unsaved'))
  expect(store.getState().persistence).toMatchObject({
    loadError: 'read-failed',
    unsaved: true,
  })
  expect(writes).toBe(0)
})

it('exposes failed writes and clears the error after retrying successfully', () => {
  const disk = storage()
  let fail = true
  const store = createProjectStore({
    storage: {
      getItem: () => disk.value,
      setItem: (key, value) => {
        if (fail) throw new Error('quota')
        disk.setItem(key, value)
      },
    },
  })
  store.getState().execute((project) => renameProject(project, 'Edited'))
  expect(store.getState().persistence).toMatchObject({
    saveError: 'write-failed',
    unsaved: true,
  })
  expect(store.getState().past).toHaveLength(1)
  fail = false
  store.getState().retrySave()
  expect(JSON.parse(disk.value!).name).toBe('Edited')
  expect(store.getState().persistence).toMatchObject({
    saveError: null,
    unsaved: false,
  })
  expect(store.getState().past).toHaveLength(1)
})

it('projects only allowed fields at every nesting level and preserves invalid measurements', () => {
  const project = createDefaultProject()
  project.modules[0]!.height = 800
  const clean = structuredClone(project)
  Object.assign(project, {
    cutList: [1],
    totalWidth: 800,
    editor: { selection: 1 },
  })
  Object.assign(project.settings, { material: 'extra' })
  Object.assign(project.modules[0]!, { x: 42, order: 3, spaces: [1] })
  Object.assign(project.modules[0]!.shelves[0]!, { width: 764 })
  Object.assign(project.modules[0]!.fronts[0]!, { calculatedHeight: 2196 })
  Object.assign(project.modules[0]!.fronts[0]!.bottomBoundary, {
    coordinate: 2,
  })
  expect(projectData(project)).toStrictEqual(clean)
  const disk = storage(JSON.stringify(project))
  const store = createProjectStore({ storage: disk })
  expect(store.getState().present).toStrictEqual(clean)
  store.getState().execute((p) => renameProject(p, 'Changed'))
  expect(JSON.parse(disk.value!)).toStrictEqual({ ...clean, name: 'Changed' })
  // Also strip fields supplied by command results, not only restored data.
  store
    .getState()
    .execute((p) =>
      Object.assign(renameProject(p, 'Again'), { spaces: ['extra'] }),
    )
  expect(JSON.parse(disk.value!)).toStrictEqual({ ...clean, name: 'Again' })
})

it('copies shelf boundary IDs and drawer data without retaining derived fields', () => {
  const project = createDefaultProject()
  project.modules[0]!.fronts = [
    {
      id: 'drawer',
      type: 'drawer',
      bottomBoundary: { type: 'module-bottom' },
      topBoundary: {
        type: 'shelf',
        shelfId: project.modules[0]!.shelves[0]!.id,
      },
    },
  ]
  const expected = structuredClone(project)
  Object.assign(project.modules[0]!.fronts[0]!.topBoundary, { top: 999 })
  const copy = projectData(project)
  expect(copy).toStrictEqual(expected)
  copy.modules[0]!.shelves[0]!.bottom = 42
  expect(project.modules[0]!.shelves[0]!.bottom).toBe(1091)
})

describe('preview commits', () => {
  it.each(['execute', 'commit'] as const)(
    'preserves undo and redo for a preview returning to baseline via %s',
    (finish) => {
      const disk = storage()
      const store = createProjectStore({ storage: disk })
      store.getState().execute((p) => renameProject(p, 'Future'))
      store.getState().undo()
      const base = store.getState().present
      const future = store.getState().future
      const writes = disk.writes
      store.getState().beginProjectPreview()
      store
        .getState()
        .updateProjectPreview(
          setModuleDimensions(base, base.modules[0]!.id, { width: 900 }),
        )
      if (finish === 'execute')
        store
          .getState()
          .execute((p) =>
            setModuleDimensions(p, base.modules[0]!.id, { width: 800 }),
          )
      else {
        store.getState().updateProjectPreview(base)
        store.getState().commitProjectPreview()
      }
      expect(store.getState().present).toStrictEqual(base)
      expect(store.getState().past).toStrictEqual([])
      expect(store.getState().future).toStrictEqual(future)
      expect(store.getState().previewBase).toBeNull()
      expect(disk.writes).toBe(writes)
    },
  )

  it('commits a changed preview through execute even when that command itself is a no-op', () => {
    const disk = storage()
    const store = createProjectStore({ storage: disk })
    const base = store.getState().present
    store
      .getState()
      .updateProjectPreview(
        setModuleDimensions(base, base.modules[0]!.id, { width: 900 }),
      )
    store.getState().execute((p) => p)
    expect(store.getState().past).toStrictEqual([base])
    expect(store.getState().previewBase).toBeNull()
    expect(JSON.parse(disk.value!).modules[0].width).toBe(900)
  })
})

describe('keyboard isolation', () => {
  it.each([
    'input',
    'textarea',
    'select',
    'contenteditable',
    'nested-contenteditable',
  ])('preserves native undo in %s', (kind) => {
    const store = createProjectStore({ storage: storage() })
    store.getState().execute((p) => renameProject(p, 'Edited'))
    const element = document.createElement(
      kind.includes('contenteditable') ? 'div' : kind,
    )
    if (kind.includes('contenteditable'))
      element.setAttribute('contenteditable', 'true')
    const target = kind.startsWith('nested')
      ? element.appendChild(document.createElement('span'))
      : element
    document.body.appendChild(element)
    const dispose = installHistoryShortcuts(store)
    try {
      for (const shiftKey of [false, true]) {
        const event = new KeyboardEvent('keydown', {
          key: 'z',
          ctrlKey: true,
          shiftKey,
          bubbles: true,
          cancelable: true,
        })
        target.dispatchEvent(event)
        expect(event.defaultPrevented).toBe(false)
        expect(store.getState().present.name).toBe('Edited')
        expect(store.getState().past).toHaveLength(1)
      }
    } finally {
      dispose()
      element.remove()
    }
  })

  it.each(['handled', 'composing'])('ignores %s keyboard events', (kind) => {
    const store = createProjectStore({ storage: storage() })
    store.getState().execute((p) => renameProject(p, 'Edited'))
    const target = new EventTarget()
    const dispose = installHistoryShortcuts(store, target)
    try {
      const event = new KeyboardEvent('keydown', {
        key: 'z',
        metaKey: true,
        cancelable: true,
        isComposing: kind === 'composing',
      })
      if (kind === 'handled') event.preventDefault()
      target.dispatchEvent(event)
      expect(store.getState().present.name).toBe('Edited')
    } finally {
      dispose()
    }
  })
})
