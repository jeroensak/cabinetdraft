import { describe, expect, it, vi } from 'vitest'
import { createProjectStore } from '../store/projectStore'
import { createDefaultProject } from '../domain/project/createDefaultProject'
import { addModule, renameProject } from '../domain/commands'
import { observeProjectChanges } from './observeProjectChanges'

describe('project engagement milestone', () => {
  it('ignores loading, selection, no-ops and preview cancellation, then reports one committed edit', () => {
    const store = createProjectStore({ initialProject: createDefaultProject() })
    const report = vi.fn()
    const unsubscribe = observeProjectChanges(store, report)
    store.getState().setSelection({
      type: 'module',
      moduleId: store.getState().present.modules[0].id,
    })
    store.getState().execute((project) => project)
    store.getState().beginProjectPreview()
    store.getState().updateProjectPreview(addModule(store.getState().present))
    store.getState().cancelProjectPreview()
    expect(report).not.toHaveBeenCalled()
    store.getState().execute(addModule)
    store.getState().execute(addModule)
    store.getState().undo()
    store.getState().redo()
    expect(report).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('reports a drag only when its changed preview is committed', () => {
    const store = createProjectStore({ initialProject: createDefaultProject() })
    const report = vi.fn()
    const unsubscribe = observeProjectChanges(store, report)
    store.getState().beginProjectPreview()
    store.getState().commitProjectPreview()
    expect(report).not.toHaveBeenCalled()
    store.getState().beginProjectPreview()
    store
      .getState()
      .updateProjectPreview(
        renameProject(store.getState().present, 'Private name'),
      )
    expect(report).not.toHaveBeenCalled()
    store.getState().commitProjectPreview()
    expect(report).toHaveBeenCalledExactlyOnceWith()
    unsubscribe()
  })

  it('ignores undo/redo and stops observing on cleanup', () => {
    const store = createProjectStore({ initialProject: createDefaultProject() })
    store.getState().execute(addModule)
    const report = vi.fn()
    const unsubscribe = observeProjectChanges(store, report)
    store.getState().undo()
    store.getState().redo()
    expect(report).not.toHaveBeenCalled()
    unsubscribe()
    store.getState().execute(addModule)
    expect(report).not.toHaveBeenCalled()
  })
})
