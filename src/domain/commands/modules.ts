import {
  leftBoundary,
  rightBoundary,
  horizontalData,
} from '../spaces/boundaries'
import type { CabinetModule } from '../cabinet/types'
import type { Boundary } from '../fronts/types'
import type { IdGenerator } from '../project/id'
import {
  DEFAULT_INCH_MODULE_DIMENSIONS,
  DEFAULT_MODULE_DIMENSIONS,
} from '../project/defaults'
import type { Project, ProjectSettings } from '../project/types'
import { isHalfStep, maxCabinetSize } from '../project/units'
import {
  allocateIds,
  cloneModule,
  CommandError,
  editProject,
  findModule,
  integer,
} from './core'

export function addModule(
  project: Project,
  generateId?: IdGenerator,
  baseName = 'Cabinet',
): Project {
  const id = allocateIds(project, generateId)
  return editProject(project, (draft) => {
    let number = 1
    while (
      draft.modules.some((module) => module.name === `${baseName} ${number}`)
    )
      number++
    draft.modules.push({
      id: id(),
      name: `${baseName} ${number}`,
      ...(draft.settings.unit === 'inch'
        ? DEFAULT_INCH_MODULE_DIMENSIONS
        : DEFAULT_MODULE_DIMENSIONS),
      shelves: [],
      dividers: [],
      fronts: [],
    })
  })
}

export function duplicateModule(
  project: Project,
  moduleId: string,
  generateId?: IdGenerator,
  copyLabel = 'copy',
): Project {
  const id = allocateIds(project, generateId)
  return editProject(project, (draft) => {
    const source = findModule(draft, moduleId)
    const copy = cloneModule(source)
    copy.id = id()
    const base = `${source.name} ${copyLabel}`
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
    const dividerIds = new Map<string, string>()
    copy.dividers = source.dividers.map((divider) => {
      const newId = id()
      dividerIds.set(divider.id, newId)
      return {
        ...divider,
        id: newId,
        bottomBoundary: remap(divider.bottomBoundary),
        topBoundary: remap(divider.topBoundary),
      }
    })
    for (const item of [...copy.shelves, ...copy.fronts]) {
      const remapHorizontal = (boundary: ReturnType<typeof leftBoundary>) => {
        if (boundary.type !== 'divider') return boundary
        const dividerId = dividerIds.get(boundary.dividerId)
        if (!dividerId)
          throw new CommandError('divider-not-found', {
            dividerId: boundary.dividerId,
          })
        return { type: 'divider' as const, dividerId }
      }
      Object.assign(
        item,
        horizontalData({
          leftBoundary: remapHorizontal(leftBoundary(item)),
          rightBoundary: remapHorizontal(rightBoundary(item)),
        }),
      )
    }
    draft.modules.splice(draft.modules.indexOf(source) + 1, 0, copy)
  })
}

export function deleteModule(project: Project, moduleId: string): Project {
  return editProject(project, (draft) => {
    findModule(draft, moduleId)
    draft.modules = draft.modules.filter((module) => module.id !== moduleId)
  })
}

function requiredName(name: string) {
  const trimmed = name.trim()
  if (!trimmed) throw new CommandError('blank-name')
  return trimmed
}

export function renameModule(
  project: Project,
  moduleId: string,
  name: string,
): Project {
  const trimmed = requiredName(name)
  return editProject(project, (draft) => {
    findModule(draft, moduleId).name = trimmed
  })
}

export function renameProject(project: Project, name: string): Project {
  const trimmed = requiredName(name)
  return editProject(project, (draft) => {
    draft.name = trimmed
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
        if (value <= 0) throw new CommandError('invalid-size', { field, value })
        if (value > maxCabinetSize(draft.settings.unit))
          throw new CommandError('size-too-large', { field, value })
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
    if (settings.edgeBanding === true) draft.settings.edgeBanding = true
    if (settings.edgeBanding === false) delete draft.settings.edgeBanding
    const band = settings.edgeBandingThickness
    if (band !== undefined) {
      if (!isHalfStep(band))
        throw new CommandError('invalid-band-thickness', { value: band })
      if (band > 0) draft.settings.edgeBandingThickness = band
      else delete draft.settings.edgeBandingThickness
    }
  })
}
