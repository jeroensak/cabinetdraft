import { create } from 'zustand'
import { updateProjectSettings, type BoundaryRange } from '../domain/commands'
import { createDefaultProject } from '../domain/project/createDefaultProject'
import {
  PROJECT_SCHEMA_VERSION,
  type Project,
  type ProjectSettings,
} from '../domain/project/types'
import type { Point, Selection } from './types'
export type { Point, Selection } from './types'

export const PROJECT_STORAGE_KEY = 'cabinet-designer:project:v1'
export interface ProjectStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
function boundary(value: unknown): boolean {
  return (
    record(value) &&
    (value.type === 'module-bottom' ||
      value.type === 'module-top' ||
      (value.type === 'shelf' && typeof value.shelfId === 'string'))
  )
}
function isProject(value: unknown): value is Project {
  if (
    !record(value) ||
    value.schemaVersion !== PROJECT_SCHEMA_VERSION ||
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    !record(value.settings) ||
    !Array.isArray(value.modules)
  )
    return false
  const settings = value.settings
  if (
    !Number.isSafeInteger(settings.corpusThickness) ||
    !Number.isSafeInteger(settings.backPanelThickness) ||
    !Number.isSafeInteger(settings.frontThickness) ||
    !Number.isSafeInteger(settings.frontGap) ||
    typeof settings.backPanelEnabled !== 'boolean'
  )
    return false
  return value.modules.every((module) => {
    if (
      !record(module) ||
      typeof module.id !== 'string' ||
      typeof module.name !== 'string' ||
      !Number.isSafeInteger(module.width) ||
      !Number.isSafeInteger(module.height) ||
      !Number.isSafeInteger(module.depth) ||
      !Array.isArray(module.shelves) ||
      !Array.isArray(module.fronts)
    )
      return false
    if (
      !module.shelves.every(
        (shelf) =>
          record(shelf) &&
          typeof shelf.id === 'string' &&
          Number.isSafeInteger(shelf.bottom),
      )
    )
      return false
    return module.fronts.every((front) => {
      if (
        !record(front) ||
        typeof front.id !== 'string' ||
        !boundary(front.bottomBoundary) ||
        !boundary(front.topBoundary)
      )
        return false
      return front.type === 'door'
        ? front.leaves === 1 || front.leaves === 2
        : front.type === 'drawer'
    })
  })
}

function readProject(storage?: ProjectStorage): Project {
  const fallback = () => createDefaultProject()
  if (!storage) return fallback()
  try {
    const raw = storage.getItem(PROJECT_STORAGE_KEY)
    if (raw === null) return fallback()
    const project: unknown = JSON.parse(raw)
    return isProject(project) ? project : fallback()
  } catch {
    return fallback()
  }
}

function saveProject(
  storage: ProjectStorage | undefined,
  project: Project,
): void {
  try {
    storage?.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project))
  } catch {
    // Storage may be unavailable or full; the current in-memory project remains usable.
  }
}

export type Hover =
  | { type: 'module'; moduleId: string }
  | { type: 'shelf'; moduleId: string; shelfId: string }
  | { type: 'space'; moduleId: string; range: BoundaryRange }
  | { type: 'front'; moduleId: string; frontId: string }
  | null

export interface ViewportState {
  zoom: number
  pan: Point
}
export interface EditorState {
  selection: Selection
  hover: Hover
  viewport: ViewportState
}

export interface ProjectStoreState {
  /** History present. Persist this object alone. */
  present: Project
  past: Project[]
  future: Project[]
  editor: EditorState
  previewBase: Project | null
  execute(command: (project: Project) => Project): void
  beginProjectPreview(): void
  updateProjectPreview(project: Project): void
  commitProjectPreview(): void
  cancelProjectPreview(): void
  undo(): void
  redo(): void
  setSelection(selection: Selection): void
  setHover(hover: Hover): void
  setViewport(viewport: Partial<ViewportState>): void
  updateSettings(settings: Partial<ProjectSettings>): void
}

export interface CreateProjectStoreOptions {
  storage?: ProjectStorage
  initialProject?: Project
}

/** A fresh isolated Zustand store; useful for tests and independent app instances. */
export function createProjectStore(options: CreateProjectStoreOptions = {}) {
  const storage = options.storage ?? browserStorage()
  return create<ProjectStoreState>((set, get) => ({
    present: options.initialProject ?? readProject(storage),
    past: [],
    future: [],
    editor: {
      selection: null,
      hover: null,
      viewport: { zoom: 1, pan: { x: 0, y: 0 } },
    },
    previewBase: null,
    execute: (command) => {
      const state = get()
      const next = command(state.present)
      if (sameProject(next, state.present)) return
      const baseline = state.previewBase ?? state.present
      set({
        present: next,
        past: [...state.past, baseline],
        future: [],
        previewBase: null,
      })
      saveProject(storage, next)
    },
    beginProjectPreview: () =>
      set((state) => (state.previewBase ? {} : { previewBase: state.present })),
    updateProjectPreview: (project) =>
      set((state) => ({
        previewBase: state.previewBase ?? state.present,
        present: project,
      })),
    commitProjectPreview: () => {
      const state = get()
      if (!state.previewBase) return
      const base = state.previewBase
      if (sameProject(base, state.present)) {
        set({ previewBase: null })
        return
      }
      set({ past: [...state.past, base], future: [], previewBase: null })
      saveProject(storage, state.present)
    },
    cancelProjectPreview: () =>
      set((state) =>
        state.previewBase
          ? { present: state.previewBase, previewBase: null }
          : {},
      ),
    undo: () => {
      const state = get()
      if (state.previewBase) {
        set({ present: state.previewBase, previewBase: null })
        return
      }
      const previous = state.past.at(-1)
      if (!previous) return
      const past = state.past.slice(0, -1)
      set({ present: previous, past, future: [state.present, ...state.future] })
      saveProject(storage, previous)
    },
    redo: () => {
      const state = get()
      if (state.previewBase) {
        set({ present: state.previewBase, previewBase: null })
        return
      }
      const next = state.future[0]
      if (!next) return
      set({
        present: next,
        past: [...state.past, state.present],
        future: state.future.slice(1),
      })
      saveProject(storage, next)
    },
    setSelection: (selection) =>
      set((state) => ({ editor: { ...state.editor, selection } })),
    setHover: (hover) =>
      set((state) => ({ editor: { ...state.editor, hover } })),
    setViewport: (viewport) =>
      set((state) => ({
        editor: {
          ...state.editor,
          viewport: {
            ...state.editor.viewport,
            ...viewport,
            pan: viewport.pan ? { ...viewport.pan } : state.editor.viewport.pan,
          },
        },
      })),
    updateSettings: (settings) =>
      get().execute((project) => {
        return updateProjectSettings(project, settings)
      }),
  }))
}

/** Application-wide store. Importing it restores the current Project at startup. */
export const useProjectStore = createProjectStore()

function sameProject(a: Project, b: Project): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function browserStorage(): ProjectStorage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage
  } catch {
    return undefined
  }
}

/** Bind the V1 undo/redo shortcuts to a window or compatible event target. */
export function installHistoryShortcuts(
  store: ReturnType<typeof createProjectStore>,
  target: Pick<Window, 'addEventListener' | 'removeEventListener'> = window,
): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    if (
      !(event.metaKey || event.ctrlKey) ||
      event.altKey ||
      event.key.toLowerCase() !== 'z'
    )
      return
    event.preventDefault()
    if (event.shiftKey) store.getState().redo()
    else store.getState().undo()
  }
  target.addEventListener('keydown', onKeyDown as EventListener)
  return () => target.removeEventListener('keydown', onKeyDown as EventListener)
}
