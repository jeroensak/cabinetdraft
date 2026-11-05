import { parseProject } from '../domain/import-export/projectJson'
import { create } from 'zustand'
import { t } from '../i18n'
import { reconcileSelection } from './selection'
import { updateProjectSettings, type BoundaryRange } from '../domain/commands'
import { projectData } from '../domain/project/projectData'
import { createDefaultProject } from '../domain/project/createDefaultProject'
import { createId } from '../domain/project/id'
import {
  DESIGN_LIBRARY_KEY,
  readLibrary,
  summaries,
  withDesign,
  type DesignSummary,
  type StoredDesign,
} from './designLibrary'
import { type Project, type ProjectSettings } from '../domain/project/types'
import type { Point, Selection } from './types'
export type { Point, Selection } from './types'

export const PROJECT_STORAGE_KEY = 'cabinet-designer:project:v1'
export interface ProjectStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
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
        try {
          return {
            project: parseProject(recoveryData),
            persistence: {
              loadError: null,
              saveError: null,
              recoveryData: null,
              unsaved: false,
            },
          }
        } catch {
          /* Preserve unreadable saved data. */
        }
        loadError = 'invalid-project'
      }
    } catch {
      loadError = 'read-failed'
    }
  }
  return {
    project: createDefaultProject(createId, {
      project: t('default.project'),
      cabinet: `${t('default.cabinet')} 1`,
    }),

    persistence: { loadError, saveError: null, recoveryData, unsaved: true },
  }
}

export type Hover =
  | { type: 'module'; moduleId: string }
  | { type: 'shelf'; moduleId: string; shelfId: string }
  | { type: 'divider'; moduleId: string; dividerId: string }
  | { type: 'space'; moduleId: string; range: BoundaryRange }
  | { type: 'front'; moduleId: string; frontId: string }
  | null

export interface ViewportState {
  zoom: number
  pan: Point
}
/** Session-only context of the drawer designer workspace; never persisted. */
export interface DrawerDesignerState {
  /** Spaces the designer was opened from; a design is applied to all of them.
   * Null when opened from the design library, which has no target spaces. */
  moduleId: string | null
  ranges: BoundaryRange[]
  designId: string | null
}
export interface EditorState {
  /** Session-only context for preserving the viewport across route remounts. */
  viewportProjectId?: string
  viewportModuleIds?: string[]
  selection: Selection
  hover: Hover
  viewport: ViewportState
  drawerDesigner?: DrawerDesignerState | null
}

export interface ProjectStoreState {
  /** History present. Persist this object alone. */
  present: Project
  past: Project[]
  future: Project[]
  editor: EditorState
  previewBase: Project | null
  persistence: PersistenceState
  /** Null when the saved library is unreadable and must be left alone. */
  designs: DesignSummary[] | null
  /** Both return false, leaving the open design as it was, when nothing changed. */
  switchDesign(id: string): boolean
  createDesign(raw: string, name: string): boolean
  /** Removes the open design and opens its neighbour; never the last design. */
  deleteDesign(): boolean
  replaceProject(raw: string): void
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
  openDrawerDesigner(context: DrawerDesignerState): void
  closeDrawerDesigner(): void
  selectDrawerDesign(designId: string | null): void
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
    /** Library first: if the second write fails, no design has been lost. */
    const openDesign = (project: Project, library: StoredDesign[]) => {
      const state = get()
      if (!storage || state.persistence.loadError) return false
      try {
        storage.setItem(DESIGN_LIBRARY_KEY, JSON.stringify(library))
        storage.setItem(
          PROJECT_STORAGE_KEY,
          JSON.stringify(projectData(project)),
        )
      } catch {
        return false
      }
      set({
        present: project,
        past: [],
        future: [],
        previewBase: null,
        designs: summaries(library),
        editor: {
          selection: null,
          hover: null,
          viewport: { zoom: 1, pan: { x: 0, y: 0 } },
        },
        persistence: {
          loadError: null,
          saveError: null,
          recoveryData: null,
          unsaved: false,
        },
      })
      return true
    }
    /** The library with the open design's latest state, or null if unreadable. */
    const currentLibrary = () => {
      const library = storage ? readLibrary(storage) : null
      const state = get()
      return library && withDesign(library, state.previewBase ?? state.present)
    }
    return {
      designs: storage ? summaries(readLibrary(storage)) : null,
      switchDesign: (id) => {
        const library = currentLibrary()
        const target = library?.find((design) => design.id === id)
        if (!library || !target) return false
        if (id === get().present.id) return true
        try {
          const project = parseProject(JSON.stringify(target.project))
          return openDesign(project, library)
        } catch {
          return false
        }
      },
      createDesign: (raw, name) => {
        const library = currentLibrary()
        if (!library) return false
        const template = parseProject(raw)
        const project = projectData({
          ...template,
          // Templates can be reused, so a design can't keep the file's ID.
          id: createId(),
          name: name.trim() || template.name,
        })
        return openDesign(project, withDesign(library, project))
      },
      deleteDesign: () => {
        const library = currentLibrary()
        if (!library) return false
        const open = get().present.id
        const index = library.findIndex((design) => design.id === open)
        const remaining = library.filter((design) => design.id !== open)
        const next = remaining[Math.min(index, remaining.length - 1)]
        if (!next) return false
        try {
          const project = parseProject(JSON.stringify(next.project))
          return openDesign(project, remaining)
        } catch {
          return false
        }
      },
      present: options.initialProject
        ? projectData(options.initialProject)
        : loaded.project,
      persistence: {
        ...loaded.persistence,
        unsaved: options.initialProject ? true : loaded.persistence.unsaved,
      },
      replaceProject: (raw) => {
        const parsed = parseProject(raw)
        const state = get()
        const replacedId = (state.previewBase ?? state.present).id
        const library = storage ? readLibrary(storage) : null
        // An import must not take over a different saved design's identity.
        const project = library?.some(
          (design) => design.id === parsed.id && design.id !== replacedId,
        )
          ? { ...parsed, id: createId() }
          : parsed
        set({
          present: project,
          past: [...state.past, state.previewBase ?? state.present],
          future: [],
          previewBase: null,
          editor: {
            selection: null,
            hover: null,
            viewport: { zoom: 1, pan: { x: 0, y: 0 } },
          },
          persistence: {
            loadError: null,
            saveError: null,
            recoveryData: null,
            unsaved: true,
          },
        })
        save(project)
        // Import replaces the open design, so its library copy goes as well.
        if (
          library &&
          project.id !== replacedId &&
          !get().persistence.saveError
        )
          try {
            const remaining = library.filter((item) => item.id !== replacedId)
            storage?.setItem(DESIGN_LIBRARY_KEY, JSON.stringify(remaining))
            set({ designs: summaries(remaining) })
          } catch {
            /* The stale entry stays selectable; nothing is lost. */
          }
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
      openDrawerDesigner: (context) =>
        set((state) => ({
          editor: {
            ...state.editor,
            hover: null,
            drawerDesigner: {
              moduleId: context.moduleId,
              ranges: context.ranges.map((range) => ({ ...range })),
              designId: context.designId,
            },
          },
        })),
      closeDrawerDesigner: () =>
        set((state) => ({ editor: { ...state.editor, drawerDesigner: null } })),
      selectDrawerDesign: (designId) =>
        set((state) =>
          state.editor.drawerDesigner
            ? {
                editor: {
                  ...state.editor,
                  drawerDesigner: { ...state.editor.drawerDesigner, designId },
                },
              }
            : {},
        ),
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
