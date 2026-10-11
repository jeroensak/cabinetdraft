import { expect, it } from 'vitest'
import { createProjectStore, PROJECT_STORAGE_KEY } from './projectStore'
import { createDefaultProject } from '../domain/project/createDefaultProject'
import { exportProject } from '../domain/import-export/projectJson'

it('replaces atomically, clears editor state, autosaves, and supports undo', () => {
  const writes: string[] = []
  const store = createProjectStore({
    storage: {
      getItem: () => null,
      setItem: (key, value) => {
        expect(key).toBe(PROJECT_STORAGE_KEY)
        writes.push(value)
      },
    },
  })
  const original = store.getState().present
  store
    .getState()
    .setSelection({ type: 'module', moduleId: original.modules[0].id })
  expect(() => store.getState().replaceProject('{')).toThrow()
  expect(store.getState().present).toBe(original)
  expect(writes).toHaveLength(0)
  const imported = createDefaultProject()
  imported.name = 'Imported design'
  imported.modules[0].width = 10
  store.getState().replaceProject(exportProject(imported))
  expect(store.getState().present).toEqual(imported)
  expect(store.getState().editor.selection).toBeNull()
  expect(store.getState().past).toHaveLength(1)
  expect(JSON.parse(writes[0])).toEqual(imported)
  store.getState().undo()
  expect(store.getState().present).toEqual(original)
  store.getState().redo()
  expect(store.getState().present).toEqual(imported)
})
