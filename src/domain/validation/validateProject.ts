import { deriveCabinetGeometry } from '../cabinet/deriveCabinetGeometry'
import {
  deriveFrontGeometry,
  type FrontGeometryIssue,
} from '../fronts/deriveFrontGeometry'
import type { Boundary } from '../fronts/types'
import type { Project } from '../project/types'
import { deriveSpaces } from '../spaces/deriveSpaces'

export type ValidationCode =
  | FrontGeometryIssue['code']
  | 'invalid-measurement'
  | 'duplicate-id'
  | 'invalid-internal-width'
  | 'invalid-interior-height'
  | 'invalid-carcass-depth'
  | 'invalid-panel-dimension'
  | 'shelf-outside-interior'
  | 'invalid-space-height'
  | 'invalid-front-range'
  | 'drawer-must-cover-one-space'
  | 'overlapping-fronts'

export interface ValidationIssue {
  code: ValidationCode
  moduleId?: string
  shelfId?: string
  frontId?: string
  data: Record<string, unknown>
}

/** Validates typed Project data without repairing it. Raw schema parsing is separate. */
export function validateProject(project: Project): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const ids = new Set<string>()
  const checkId = (id: string) => {
    if (ids.has(id)) issues.push({ code: 'duplicate-id', data: { id } })
    ids.add(id)
  }
  const measurement = (
    field: string,
    value: number,
    minimum: number,
    moduleId?: string,
    shelfId?: string,
  ) => {
    if (!Number.isSafeInteger(value) || value < minimum) {
      issues.push({
        code: 'invalid-measurement',
        moduleId,
        shelfId,
        data: { field, value, minimum },
      })
    }
  }
  checkId(project.id)
  for (const field of [
    'corpusThickness',
    'backPanelThickness',
    'frontThickness',
    'frontGap',
  ] as const) {
    measurement(field, project.settings[field], field === 'frontGap' ? 0 : 1)
  }

  for (const module of project.modules) {
    checkId(module.id)
    const moduleId = module.id
    for (const field of ['width', 'height', 'depth'] as const)
      measurement(field, module[field], 1, moduleId)
    const geometry = deriveCabinetGeometry(module, project.settings)
    if (!(geometry.internalWidth > 0))
      issues.push({
        code: 'invalid-internal-width',
        moduleId,
        data: { value: geometry.internalWidth },
      })
    if (!(geometry.interiorTop > geometry.interiorBottom))
      issues.push({
        code: 'invalid-interior-height',
        moduleId,
        data: { bottom: geometry.interiorBottom, top: geometry.interiorTop },
      })
    if (!(geometry.carcassDepth > 0))
      issues.push({
        code: 'invalid-carcass-depth',
        moduleId,
        data: { value: geometry.carcassDepth },
      })

    for (const shelf of module.shelves) {
      checkId(shelf.id)
      measurement('bottom', shelf.bottom, 0, moduleId, shelf.id)
    }
    for (const panel of geometry.panels) {
      for (const dimension of ['length', 'width', 'thickness'] as const) {
        const value = panel[dimension]
        if (!Number.isSafeInteger(value) || value <= 0)
          issues.push({
            code: 'invalid-panel-dimension',
            moduleId,
            data: { source: panel.source, dimension, value },
          })
      }
      if (
        panel.source.type === 'shelf' &&
        (panel.position.y < geometry.interiorBottom ||
          panel.position.y + panel.thickness > geometry.interiorTop)
      ) {
        issues.push({
          code: 'shelf-outside-interior',
          moduleId,
          shelfId: panel.source.shelfId,
          data: { bottom: panel.position.y, thickness: panel.thickness },
        })
      }
    }
    for (const space of deriveSpaces(module, project.settings)) {
      if (!Number.isFinite(space.height) || space.height <= 0)
        issues.push({
          code: 'invalid-space-height',
          moduleId,
          data: { ...space },
        })
    }

    const sortedShelves = [...module.shelves].sort(
      (a, b) => a.bottom - b.bottom,
    )
    const boundaryIndex = (boundary: Boundary): number | undefined => {
      if (boundary.type === 'module-bottom') return 0
      if (boundary.type === 'module-top') return sortedShelves.length + 1
      const index = sortedShelves.findIndex(
        (shelf) => shelf.id === boundary.shelfId,
      )
      return index === -1 ? undefined : index + 1
    }
    const ranges: { frontId: string; bottom: number; top: number }[] = []
    for (const front of module.fronts) {
      checkId(front.id)
      const frontGeometry = deriveFrontGeometry(module, project.settings, front)
      for (const issue of frontGeometry.issues) {
        const { code, moduleId: issueModuleId, frontId, ...data } = issue
        issues.push({ code, moduleId: issueModuleId, frontId, data })
      }
      const bottom = boundaryIndex(front.bottomBoundary)
      const top = boundaryIndex(front.topBoundary)
      if (bottom === undefined || top === undefined) continue // Reported by front geometry.
      if (bottom >= top) {
        issues.push({
          code: 'invalid-front-range',
          moduleId,
          frontId: front.id,
          data: {
            bottomBoundary: front.bottomBoundary,
            topBoundary: front.topBoundary,
          },
        })
        continue
      }
      if (front.type === 'drawer' && top - bottom !== 1)
        issues.push({
          code: 'drawer-must-cover-one-space',
          moduleId,
          frontId: front.id,
          data: { spaceCount: top - bottom },
        })
      for (const other of ranges) {
        if (bottom < other.top && top > other.bottom)
          issues.push({
            code: 'overlapping-fronts',
            moduleId,
            frontId: front.id,
            data: { otherFrontId: other.frontId },
          })
      }
      ranges.push({ frontId: front.id, bottom, top })
    }
  }
  return issues
}
