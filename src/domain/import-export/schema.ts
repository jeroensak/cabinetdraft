import { PROJECT_SCHEMA_VERSION, type Project } from '../project/types'
import { verticalBounds } from '../spaces/boundaries'

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
function horizontalRange(value: Record<string, unknown>): boolean {
  return ['leftBoundary', 'rightBoundary'].every((edge) => {
    const b = value[edge]
    return (
      b === undefined ||
      (record(b) &&
        (b.type ===
          (edge === 'leftBoundary' ? 'module-left' : 'module-right') ||
          (b.type === 'divider' && typeof b.dividerId === 'string')))
    )
  })
}
function drawerDesign(value: unknown): boolean {
  if (
    !record(value) ||
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    value.slideType !== 'undermount'
  )
    return false
  return [
    'wallThickness',
    'bottomThickness',
    'depth',
    'heightPercent',
    'sideClearance',
    'bottomClearance',
    'topClearance',
    'rearClearance',
    'bottomRecess',
  ].every((field) => Number.isSafeInteger(value[field]))
}
export function isProject(value: unknown): value is Project {
  if (
    !record(value) ||
    value.schemaVersion !== PROJECT_SCHEMA_VERSION ||
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    !record(value.settings) ||
    !Array.isArray(value.drawerDesigns) ||
    !value.drawerDesigns.every(drawerDesign) ||
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
      !Array.isArray(module.dividers) ||
      !Array.isArray(module.fronts)
    )
      return false
    if (
      !module.shelves.every(
        (shelf) =>
          record(shelf) &&
          typeof shelf.id === 'string' &&
          Number.isSafeInteger(shelf.bottom) &&
          horizontalRange(shelf),
      )
    )
      return false
    if (
      !module.dividers.every(
        (divider) =>
          record(divider) &&
          typeof divider.id === 'string' &&
          Number.isSafeInteger(divider.left) &&
          boundary(divider.bottomBoundary) &&
          boundary(divider.topBoundary),
      )
    )
      return false
    return module.fronts.every((front) => {
      if (
        !record(front) ||
        typeof front.id !== 'string' ||
        !horizontalRange(front) ||
        !boundary(front.bottomBoundary) ||
        !boundary(front.topBoundary)
      )
        return false
      return front.type === 'door'
        ? front.leaves === 1 || front.leaves === 2
        : front.type === 'drawer' &&
            (front.drawerDesignId === undefined ||
              typeof front.drawerDesignId === 'string')
    })
  })
}

/** V1 projects remain importable; the migration only adds the new empty collection. */
export function migrateV1(value: unknown): Project | null {
  if (
    !record(value) ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.modules)
  )
    return null
  const migrated = {
    ...value,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    drawerDesigns: [],
    modules: value.modules.map((module) =>
      record(module) ? { ...module, dividers: [] } : module,
    ),
  }
  return isProject(migrated) ? migrated : null
}

/** V2 already has dividers; omitted horizontal bounds retain full-width semantics. */
export function migrateV2(value: unknown): Project | null {
  if (!record(value) || value.schemaVersion !== 2) return null
  const migrated = {
    ...value,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    drawerDesigns: [],
  }
  return isProject(migrated) ? migrated : null
}

/** V3 spaces/fronts are unchanged; a new reusable drawer library starts empty. */
export function migrateV3(value: unknown): Project | null {
  if (!record(value) || value.schemaVersion !== 3) return null
  const migrated = {
    ...value,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    drawerDesigns: [],
  }
  return isProject(migrated) ? migrated : null
}

/** The whole percentage closest to a V4 fixed height in the first drawer using
 * the design. Out-of-range results stay as they are for validation to report. */
function percentForFixedHeight(
  project: Project,
  designId: string,
  height: number,
): number {
  for (const module of project.modules)
    for (const front of module.fronts) {
      if (front.type !== 'drawer' || front.drawerDesignId !== designId) continue
      const { top, bottom } = verticalBounds(module, project.settings, front)
      return top > bottom ? Math.round((height / (top - bottom)) * 100) : 50
    }
  return 50
}

/** V4 designs stored a fixed height in mm, or null for half the opening. */
export function migrateV4(value: unknown): Project | null {
  if (
    !record(value) ||
    value.schemaVersion !== 4 ||
    !Array.isArray(value.drawerDesigns) ||
    !value.drawerDesigns.every(
      (design) =>
        record(design) &&
        (design.height === null || Number.isSafeInteger(design.height)),
    )
  )
    return null
  const designs = value.drawerDesigns as Record<string, unknown>[]
  const migrated = {
    ...value,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    drawerDesigns: designs.map((design) => ({ ...design, heightPercent: 50 })),
  }
  if (!isProject(migrated)) return null
  return {
    ...migrated,
    drawerDesigns: migrated.drawerDesigns.map((design, index) => {
      const height = designs[index]!.height
      return typeof height === 'number'
        ? {
            ...design,
            heightPercent: percentForFixedHeight(migrated, design.id, height),
          }
        : design
    }),
  }
}
