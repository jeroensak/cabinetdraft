import { describe, expect, it } from 'vitest'
import { createDefaultProject } from '../domain/project/createDefaultProject'
import { exportProject } from '../domain/import-export/projectJson'
import { renameProject } from '../domain/commands'
import { DESIGN_LIBRARY_KEY } from './designLibrary'
import { createProjectStore, PROJECT_STORAGE_KEY } from './projectStore'

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    data,
    failWrites: false,
    getItem(key: string) {
      return data.get(key) ?? null
    },
    setItem(key: string, value: string) {
      if (this.failWrites) throw new Error('quota')
      data.set(key, value)
    },
  }
}
const template = (name = 'Template') =>
  exportProject({ ...createDefaultProject(), name })

describe('local designs', () => {
  it('keeps both designs when creating one, and switches back to the first', () => {
    const disk = memory()
    const store = createProjectStore({ storage: disk })
    store.getState().execute((p) => renameProject(p, 'Kitchen'))
    const kitchen = store.getState().present.id
    expect(store.getState().createDesign(template(), '  Hall  ')).toBe(true)
    const state = store.getState()
    expect(state.present.name).toBe('Hall')
    expect(state.present.id).not.toBe(kitchen)
    expect(state.past).toHaveLength(0)
    expect(state.designs?.map((d) => d.name)).toStrictEqual(['Kitchen', 'Hall'])
    store.getState().execute((p) => renameProject(p, 'Hallway'))
    expect(store.getState().switchDesign(kitchen)).toBe(true)
    expect(store.getState().present.name).toBe('Kitchen')
    expect(JSON.parse(disk.getItem(PROJECT_STORAGE_KEY)!).name).toBe('Kitchen')
    expect(store.getState().designs?.map((d) => d.name)).toStrictEqual([
      'Kitchen',
      'Hallway',
    ])
  })

  it('restores the open design and library after a reload', () => {
    const disk = memory()
    const first = createProjectStore({ storage: disk })
    first.getState().createDesign(template(), 'Second')
    const reloaded = createProjectStore({ storage: disk }).getState()
    expect(reloaded.present.name).toBe('Second')
    expect(reloaded.designs).toHaveLength(2)
  })

  it('gives each design from one template its own ID and falls back to the template name', () => {
    const store = createProjectStore({ storage: memory() })
    const raw = template('Wardrobe')
    store.getState().createDesign(raw, '')
    const first = store.getState().present
    store.getState().createDesign(raw, '')
    expect(first.name).toBe('Wardrobe')
    expect(store.getState().present.id).not.toBe(first.id)
    expect(store.getState().designs).toHaveLength(3)
  })

  it('deletes the open design for good, opens a neighbour and keeps the last one', () => {
    const disk = memory()
    const store = createProjectStore({ storage: disk })
    store.getState().execute((p) => renameProject(p, 'First'))
    store.getState().createDesign(template(), 'Second')
    store.getState().createDesign(template(), 'Third')
    const second = store.getState().designs![1]!
    store.getState().switchDesign(second.id)

    expect(store.getState().deleteDesign()).toBe(true)
    expect(store.getState().present.name).toBe('Third')
    expect(store.getState().past).toHaveLength(0)
    expect(disk.getItem(DESIGN_LIBRARY_KEY)).not.toContain('Second')
    expect(disk.getItem(PROJECT_STORAGE_KEY)).toContain('Third')

    expect(store.getState().deleteDesign()).toBe(true)
    expect(store.getState().present.name).toBe('First')
    expect(store.getState().deleteDesign()).toBe(false)
    expect(store.getState().present.name).toBe('First')
    const reloaded = createProjectStore({ storage: disk }).getState()
    expect(reloaded.present.name).toBe('First')
    expect(reloaded.designs).toHaveLength(1)
  })

  it('keeps the design when the delete cannot be saved', () => {
    const disk = memory()
    const store = createProjectStore({ storage: disk })
    store.getState().createDesign(template(), 'Second')
    disk.failWrites = true
    expect(store.getState().deleteDesign()).toBe(false)
    expect(store.getState().present.name).toBe('Second')
    expect(store.getState().designs).toHaveLength(2)
  })

  it('stays on the open design and keeps its history when saving fails', () => {
    const disk = memory()
    const store = createProjectStore({ storage: disk })
    store.getState().execute((p) => renameProject(p, 'Kept'))
    disk.failWrites = true
    expect(store.getState().createDesign(template(), 'New')).toBe(false)
    expect(store.getState().present.name).toBe('Kept')
    expect(store.getState().past).toHaveLength(1)
  })

  it('never writes over an unreadable library or unreadable project', () => {
    const library = memory({ [DESIGN_LIBRARY_KEY]: 'not json' })
    const store = createProjectStore({ storage: library })
    expect(store.getState().designs).toBeNull()
    expect(store.getState().createDesign(template(), 'New')).toBe(false)
    expect(library.getItem(DESIGN_LIBRARY_KEY)).toBe('not json')
    const project = memory({ [PROJECT_STORAGE_KEY]: 'not json' })
    const blocked = createProjectStore({ storage: project })
    expect(blocked.getState().createDesign(template(), 'New')).toBe(false)
    expect(project.getItem(PROJECT_STORAGE_KEY)).toBe('not json')
    expect(project.getItem(DESIGN_LIBRARY_KEY)).toBeNull()
  })

  it('import replaces the open design without taking over another saved one', () => {
    const disk = memory()
    const store = createProjectStore({ storage: disk })
    store.getState().createDesign(template(), 'Second')
    const second = store.getState().present
    const first = store.getState().designs![0]!
    expect(store.getState().switchDesign(first.id)).toBe(true)
    store.getState().replaceProject(exportProject(second))
    const state = store.getState()
    expect(state.present.id).not.toBe(second.id)
    expect(state.designs?.map((d) => d.id)).toStrictEqual([second.id])
    expect(state.switchDesign(second.id)).toBe(true)
    expect(store.getState().designs).toHaveLength(2)
  })
})
