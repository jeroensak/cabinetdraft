import { PROJECT_SCHEMA_VERSION, type Project } from '../project/types'

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
export function isProject(value: unknown): value is Project {
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
