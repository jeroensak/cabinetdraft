import { frontDesign } from '../drawers/types'
import {
  deriveDrawerGeometry,
  validateDrawerDesign,
  type DrawerIssue,
} from '../drawers/deriveDrawerGeometry'
import { deriveCabinetGeometry } from '../cabinet/deriveCabinetGeometry'
import {
  deriveFrontGeometry,
  type FrontGeometryIssue,
} from '../fronts/deriveFrontGeometry'
import type { Boundary } from '../fronts/types'
import type { Project } from '../project/types'
import { deriveSpacePartition } from '../spaces/deriveSpaces'
import {
  horizontalBounds,
  leftBoundary,
  rightBoundary,
  verticalBounds,
  sameBoundary,
} from '../spaces/boundaries'
import { spacesForRange, rangeBounds } from '../spaces/spaceRanges'

export type ValidationCode =
  | FrontGeometryIssue['code']
  | DrawerIssue['code']
  | 'missing-drawer-design'
  | 'invalid-measurement'
  | 'duplicate-id'
  | 'invalid-internal-width'
  | 'invalid-interior-height'
  | 'invalid-carcass-depth'
  | 'invalid-panel-dimension'
  | 'shelf-outside-interior'
  | 'invalid-space-height'
  | 'invalid-divider-range'
  | 'invalid-shelf-range'
  | 'cyclic-panel-reference'
  | 'invalid-space-partition'
  | 'panel-intersection'
  | 'panel-outside-support'
  | 'divider-outside-interior'
  | 'invalid-slot-width'
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
  for (const design of project.drawerDesigns) {
    checkId(design.id)
    for (const issue of validateDrawerDesign(design))
      issues.push({
        code: issue.code,
        data: {
          designId: design.id,
          message: issue.message,
          field: issue.field,
        },
      })
  }
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
    const { spaces, unresolved } = deriveSpacePartition(
      module,
      project.settings,
    )
    if (unresolved.length)
      issues.push({
        code: 'invalid-space-partition',
        moduleId,
        data: { panelIds: unresolved },
      })
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
    for (const divider of module.dividers) {
      checkId(divider.id)
      measurement('left', divider.left, 0, moduleId)
      const validBoundary = (b: Boundary) =>
        b.type !== 'shelf' || module.shelves.some((s) => s.id === b.shelfId)
      if (
        !validBoundary(divider.bottomBoundary) ||
        !validBoundary(divider.topBoundary) ||
        sameBoundary(divider.bottomBoundary, divider.topBoundary)
      )
        issues.push({
          code: 'invalid-divider-range',
          moduleId,
          data: {
            dividerId: divider.id,
            bottomBoundary: divider.bottomBoundary,
            topBoundary: divider.topBoundary,
          },
        })
      if (
        divider.left < project.settings.corpusThickness ||
        divider.left + project.settings.corpusThickness >
          project.settings.corpusThickness + geometry.internalWidth
      )
        issues.push({
          code: 'divider-outside-interior',
          moduleId,
          data: { dividerId: divider.id, left: divider.left },
        })
    }
    for (const divider of module.dividers) {
      for (const boundary of [divider.bottomBoundary, divider.topBoundary]) {
        if (boundary.type !== 'shelf') continue
        const shelf = module.shelves.find((s) => s.id === boundary.shelfId)
        if (!shelf) continue
        const support = horizontalBounds(module, project.settings, shelf)
        if (
          divider.left < support.left ||
          divider.left + project.settings.corpusThickness > support.right
        )
          issues.push({
            code: 'panel-outside-support',
            moduleId,
            data: { dividerId: divider.id, shelfId: shelf.id },
          })
      }
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
    for (const space of spaces) {
      if (!Number.isFinite(space.height) || space.height <= 0)
        issues.push({
          code: 'invalid-space-height',
          moduleId,
          data: { ...space },
        })
      if (!Number.isSafeInteger(space.width) || space.width <= 0)
        issues.push({
          code: 'invalid-slot-width',
          moduleId,
          data: { left: space.left, right: space.right, width: space.width },
        })
    }
    const dependencies = new Map<string, string[]>()
    for (const shelf of module.shelves) {
      const refs = [leftBoundary(shelf), rightBoundary(shelf)].flatMap((b) =>
        b.type === 'divider' ? [b.dividerId] : [],
      )
      dependencies.set(shelf.id, refs)
      if (refs.some((id) => !module.dividers.some((d) => d.id === id)))
        issues.push({
          code: 'invalid-shelf-range',
          moduleId,
          shelfId: shelf.id,
          data: {},
        })
      for (const id of refs) {
        const divider = module.dividers.find((d) => d.id === id)
        if (!divider) continue
        const b = verticalBounds(module, project.settings, divider)
        if (
          shelf.bottom < b.bottom ||
          shelf.bottom + project.settings.corpusThickness > b.top
        )
          issues.push({
            code: 'panel-outside-support',
            moduleId,
            shelfId: shelf.id,
            data: { dividerId: id },
          })
      }
    }
    for (const divider of module.dividers)
      dependencies.set(
        divider.id,
        [divider.bottomBoundary, divider.topBoundary].flatMap((b) =>
          b.type === 'shelf' ? [b.shelfId] : [],
        ),
      )
    const done = new Set<string>(),
      visiting = new Set<string>()
    const cycle = (id: string): boolean => {
      if (visiting.has(id)) return true
      if (done.has(id)) return false
      visiting.add(id)
      const result = (dependencies.get(id) ?? []).some(cycle)
      visiting.delete(id)
      done.add(id)
      return result
    }
    if ([...dependencies.keys()].some(cycle))
      issues.push({ code: 'cyclic-panel-reference', moduleId, data: {} })
    const internal = geometry.panels.filter(
      (p) => p.source.type === 'shelf' || p.source.type === 'divider',
    )
    for (let i = 0; i < internal.length; i++)
      for (let j = i + 1; j < internal.length; j++) {
        const a = internal[i],
          b = internal[j]
        const box = (p: typeof a) => ({
          left: p.position.x,
          right:
            p.position.x + (p.orientation === 'side' ? p.thickness : p.length),
          bottom: p.position.y,
          top:
            p.position.y + (p.orientation === 'side' ? p.length : p.thickness),
        })
        const x = box(a),
          y = box(b)
        if (
          x.left < y.right &&
          x.right > y.left &&
          x.bottom < y.top &&
          x.top > y.bottom
        )
          issues.push({
            code: 'panel-intersection',
            moduleId,
            data: { first: a.source, second: b.source },
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
    const ranges: {
      frontId: string
      bottom: number
      top: number
      left: number
      right: number
    }[] = []
    const partitioned =
      module.dividers.length > 0 ||
      module.shelves.some((s) => s.leftBoundary || s.rightBoundary)
    const healthyPartition =
      !unresolved.length && spaces.every((s) => s.width > 0 && s.height > 0)
    for (const front of module.fronts) {
      checkId(front.id)
      if (front.type === 'drawer' && front.drawerDesignId !== undefined) {
        const design = project.drawerDesigns.find(
          (d) => d.id === front.drawerDesignId,
        )
        if (!design)
          issues.push({
            code: 'missing-drawer-design',
            moduleId,
            frontId: front.id,
            data: { designId: front.drawerDesignId },
          })
        else
          for (const issue of deriveDrawerGeometry(
            module,
            project.settings,
            front,
            design,
          ).issues)
            issues.push({
              code: issue.code,
              moduleId,
              frontId: front.id,
              data: {
                designId: design.id,
                message: issue.message,
                field: issue.field,
              },
            })
      }
      const frontGeometry = deriveFrontGeometry(
        module,
        project.settings,
        front,
        frontDesign(project.drawerDesigns, front),
      )
      for (const issue of frontGeometry.issues) {
        const { code, moduleId: issueModuleId, frontId, ...data } = issue
        issues.push({ code, moduleId: issueModuleId, frontId, data })
      }
      const box = rangeBounds(module, project.settings, front)
      const bottom = partitioned
        ? box.bottom
        : boundaryIndex(front.bottomBoundary)
      const top = partitioned ? box.top : boundaryIndex(front.topBoundary)
      if (
        bottom === undefined ||
        top === undefined ||
        !Number.isFinite(bottom) ||
        !Number.isFinite(top)
      )
        continue
      if (bottom >= top || box.left >= box.right) {
        // Non-positive physical sizes are geometric errors; reversed legacy references are structural.
        if (!partitioned)
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
      const covered = partitioned
        ? spacesForRange(module, project.settings, front)
        : []
      if (partitioned && healthyPartition && !covered.length)
        issues.push({
          code: 'invalid-front-range',
          moduleId,
          frontId: front.id,
          data: {},
        })
      const spaceCount = partitioned ? covered.length : top - bottom
      if (
        front.type === 'drawer' &&
        (!partitioned || healthyPartition) &&
        spaceCount !== 1
      )
        issues.push({
          code: 'drawer-must-cover-one-space',
          moduleId,
          frontId: front.id,
          data: { spaceCount },
        })

      for (const other of ranges) {
        if (
          bottom < other.top &&
          top > other.bottom &&
          box.left < other.right &&
          box.right > other.left
        )
          issues.push({
            code: 'overlapping-fronts',
            moduleId,
            frontId: front.id,
            data: { otherFrontId: other.frontId },
          })
      }
      ranges.push({
        frontId: front.id,
        bottom,
        top,
        left: box.left,
        right: box.right,
      })
    }
  }
  return issues
}
