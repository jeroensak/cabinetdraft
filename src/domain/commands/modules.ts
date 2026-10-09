import type { CabinetModule } from '../cabinet/types'
import type { Boundary } from '../fronts/types'
import type { IdGenerator } from '../project/id'
import { DEFAULT_MODULE_DIMENSIONS } from '../project/defaults'
import type { Project, ProjectSettings } from '../project/types'
import {
  allocateIds,
  cloneModule,
  CommandError,
  editProject,
  findModule,
  integer,
} from './core'

export function addModule(project: Project, generateId?: IdGenerator): Project {
  const id = allocateIds(project, generateId)
  return editProject(project, (draft) => {
    let number = 1
    while (draft.modules.some((module) => module.name === `Cabinet ${number}`))
      number++
    draft.modules.push({
      id: id(),
      name: `Cabinet ${number}`,
      ...DEFAULT_MODULE_DIMENSIONS,
      shelves: [],
      fronts: [],
    })
  })
}

export function duplicateModule(
  project: Project,
  moduleId: string,
  generateId?: IdGenerator,
): Project {
  const id = allocateIds(project, generateId)
  return editProject(project, (draft) => {
    const source = findModule(draft, moduleId)
    const copy = cloneModule(source)
    copy.id = id()
    const base = `${source.name} copy`
    copy.name = base
    let suffix = 2
    while (draft.modules.some((module) => module.name === copy.name))
      copy.name = `${base} ${suffix++}`
    const shelfIds = new Map<string, string>()
    copy.shelves = source.shelves.map((shelf) => {
      const newId = id()
      shelfIds.set(shelf.id, newId)
      return { ...shelf, id: newId }
    })
    const remap = (boundary: Boundary): Boundary => {
      if (boundary.type !== 'shelf') return { ...boundary }
      const shelfId = shelfIds.get(boundary.shelfId)
      if (!shelfId)
        throw new CommandError('shelf-not-found', { shelfId: boundary.shelfId })
      return { type: 'shelf', shelfId }
    }
    copy.fronts = source.fronts.map((front) => ({
      ...front,
      id: id(),
      bottomBoundary: remap(front.bottomBoundary),
      topBoundary: remap(front.topBoundary),
    }))
    draft.modules.splice(draft.modules.indexOf(source) + 1, 0, copy)
  })
}

export function deleteModule(project: Project, moduleId: string): Project {
  return editProject(project, (draft) => {
    findModule(draft, moduleId)
    draft.modules = draft.modules.filter((module) => module.id !== moduleId)
  })
}

export function renameModule(
  project: Project,
  moduleId: string,
  name: string,
): Project {
  return editProject(project, (draft) => {
    findModule(draft, moduleId).name = name
  })
}

export function renameProject(project: Project, name: string): Project {
  return editProject(project, (draft) => {
    draft.name = name
  })
}

export function reorderModules(
  project: Project,
  moduleIds: readonly string[],
): Project {
  if (
    moduleIds.length !== project.modules.length ||
    new Set(moduleIds).size !== moduleIds.length ||
    moduleIds.some((id) => !project.modules.some((module) => module.id === id))
  ) {
    throw new CommandError('invalid-module-order', { moduleIds })
  }
  return editProject(project, (draft) => {
    draft.modules = moduleIds.map((id) => findModule(draft, id))
  })
}

export function setModuleDimensions(
  project: Project,
  moduleId: string,
  dimensions: Partial<Pick<CabinetModule, 'width' | 'height' | 'depth'>>,
): Project {
  return editProject(project, (draft) => {
    const module = findModule(draft, moduleId)
    for (const field of ['width', 'height', 'depth'] as const) {
      const value = dimensions[field]
      if (value !== undefined) {
        integer(value, field)
        module[field] = value
      }
    }
  })
}

export function updateProjectSettings(
  project: Project,
  settings: Partial<ProjectSettings>,
): Project {
  return editProject(project, (draft) => {
    for (const field of [
      'corpusThickness',
      'backPanelThickness',
      'frontThickness',
      'frontGap',
    ] as const) {
      const value = settings[field]
      if (value !== undefined) {
        integer(value, field)
        draft.settings[field] = value
      }
    }
    if (settings.backPanelEnabled !== undefined)
      draft.settings.backPanelEnabled = settings.backPanelEnabled
  })
}
