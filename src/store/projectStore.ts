import { create } from 'zustand'
import { reconcileSelection } from './selection'
import { updateProjectSettings, type BoundaryRange } from '../domain/commands'
import { projectData } from '../domain/project/projectData'
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

export interface PersistenceState {
  loadError: 'invalid-project' | 'read-failed' | 'storage-unavailable' | null
  saveError: 'write-failed' | 'blocked-by-load-error' | null
  /** Original unreadable payload, also left untouched in storage. */
  recoveryData: string | null
  unsaved: boolean
}

function readProject(storage?: ProjectStorage): {
  project: Project
  persistence: PersistenceState
} {
  let loadError: PersistenceState['loadError'] = storage
    ? null
    : 'storage-unavailable'
  let recoveryData: string | null = null
  if (storage) {
    try {
      recoveryData = storage.getItem(PROJECT_STORAGE_KEY)
      if (recoveryData !== null) {
        let parsed: unknown
        try {
          parsed = JSON.parse(recoveryData)
        } catch {
          /* Retain the original payload below. */
        }
        if (isProject(parsed))
          return {
            project: projectData(parsed),
            persistence: {
              loadError: null,
              saveError: null,
              recoveryData: null,
              unsaved: false,
            },
          }
        loadError = 'invalid-project'
      }
    } catch {
      loadError = 'read-failed'
    }
  }
  return {
    project: createDefaultProject(),
    persistence: { loadError, saveError: null, recoveryData, unsaved: true },
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
  /** Session-only context for preserving the viewport across route remounts. */
  viewportProjectId?: string
  viewportModuleIds?: string[]
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
  persistence: PersistenceState
  retrySave(): void
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
  const loaded = readProject(storage)
  const store = create<ProjectStoreState>((set, get) => {
    const save = (project: Project) => {
      const previous = get().persistence
      if (previous.loadError || !storage) {
        set({
          persistence: {
            ...previous,
            saveError: 'blocked-by-load-error',
            unsaved: true,
          },
        })
        return
      }
      try {
        storage.setItem(
          PROJECT_STORAGE_KEY,
          JSON.stringify(projectData(project)),
        )
        set({ persistence: { ...previous, saveError: null, unsaved: false } })
      } catch {
        set({
          persistence: {
            ...previous,
            saveError: 'write-failed',
            unsaved: true,
          },
        })
      }
    }
    return {
      present: options.initialProject
        ? projectData(options.initialProject)
        : loaded.project,
      persistence: {
        ...loaded.persistence,
        unsaved: options.initialProject ? true : loaded.persistence.unsaved,
      },
      retrySave: () => save(get().previewBase ?? get().present),
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
        const next = projectData(command(state.present))
        const baseline = state.previewBase ?? state.present
        if (sameProject(next, baseline)) {
          if (state.previewBase) set({ present: baseline, previewBase: null })
          return
        }
        set({
          present: next,
          past: [...state.past, baseline],
          future: [],
          previewBase: null,
        })
        save(next)
      },
      beginProjectPreview: () =>
        set((state) =>
          state.previewBase ? {} : { previewBase: state.present },
        ),
      updateProjectPreview: (project) =>
        set((state) => ({
          previewBase: state.previewBase ?? state.present,
          present: projectData(project),
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
        save(state.present)
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
        set({
          present: previous,
          past,
          future: [state.present, ...state.future],
        })
        save(previous)
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
        save(next)
      },
      setSelection: (selection) =>
        set((state) => ({ editor: { ...state.editor, selection } })),
      setHover: (hover) =>
        set((state) => ({ editor: { ...state.editor, hover } })),
      setViewport: (viewport) =>
        set((state) => ({
          editor: {
            ...state.editor,
            viewportProjectId: state.present.id,
            viewportModuleIds: state.present.modules.map((module) => module.id),
            viewport: {
              ...state.editor.viewport,
              ...viewport,
              pan: viewport.pan
                ? { ...viewport.pan }
                : state.editor.viewport.pan,
            },
          },
        })),
      updateSettings: (settings) =>
        get().execute((project) => {
          return updateProjectSettings(project, settings)
        }),
    }
  })
  store.subscribe((state, previous) => {
    if (state.present === previous.present) return
    const selection = reconcileSelection(
      previous.present,
      state.present,
      state.editor.selection,
    )
    const hover = reconcileSelection(
      previous.present,
      state.present,
      state.editor.hover,
    )
    if (selection !== state.editor.selection || hover !== state.editor.hover) {
      store.setState({ editor: { ...state.editor, selection, hover } })
    }
  })
  return store
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
      event.defaultPrevented ||
      event.isComposing ||
      !(event.metaKey || event.ctrlKey) ||
      event.altKey ||
      event.key.toLowerCase() !== 'z'
    )
      return
    const editable = event
      .composedPath()
      .some(
        (node) =>
          node instanceof HTMLElement &&
          (/^(INPUT|TEXTAREA|SELECT)$/.test(node.tagName) ||
            node.isContentEditable ||
            node.closest('[contenteditable]:not([contenteditable="false"])') !==
              null),
      )
    if (editable) return
    event.preventDefault()
    if (event.shiftKey) store.getState().redo()
    else store.getState().undo()
  }
  target.addEventListener('keydown', onKeyDown as EventListener)
  return () => target.removeEventListener('keydown', onKeyDown as EventListener)
}
