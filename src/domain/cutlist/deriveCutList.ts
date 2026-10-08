import { deriveCabinetGeometry } from '../cabinet/deriveCabinetGeometry'
import { deriveFrontGeometry } from '../fronts/deriveFrontGeometry'
import type { PanelSource } from '../geometry/physicalPanel'
import type { Project } from '../project/types'
import {
  validateProject,
  type ValidationIssue,
} from '../validation/validateProject'

export interface CutListItem {
  id: string
  moduleId: string
  moduleName: string
  part: PanelSource['type']
  quantity: 1
  length: number
  width: number
  thickness: number
}

export type CutListResult =
  | { available: true; items: CutListItem[] }
  | { available: false; issues: ValidationIssue[] }

/** Independent domain consumer; invalid projects expose no manufacturing rows. */
export function deriveCutList(project: Project): CutListResult {
  const issues = validateProject(project)
  if (issues.length > 0) return { available: false, issues }

  const items: CutListItem[] = []
  project.modules.forEach((module, moduleIndex) => {
    const shelves = [...module.shelves].sort((a, b) => a.bottom - b.bottom)
    const doors = module.fronts.filter((front) => front.type === 'door')
    const drawers = module.fronts.filter((front) => front.type === 'drawer')
    const suffix = (source: PanelSource): string => {
      switch (source.type) {
        case 'side-left':
          return 'SIDE-L'
        case 'side-right':
          return 'SIDE-R'
        case 'top':
          return 'TOP'
        case 'bottom':
          return 'BOTTOM'
        case 'back':
          return 'BACK'
        case 'shelf':
          return `SHELF-${shelves.findIndex((shelf) => shelf.id === source.shelfId) + 1}`
        case 'door':
          return `DOOR-${doors.findIndex((front) => front.id === source.frontId) + 1}${source.leaf === 'single' ? '' : source.leaf === 'left' ? '-L' : '-R'}`
        case 'drawer':
          return `DRAWER-${drawers.findIndex((front) => front.id === source.frontId) + 1}`
      }
    }
    const panels = [
      ...deriveCabinetGeometry(module, project.settings).panels,
      ...module.fronts.flatMap(
        (front) => deriveFrontGeometry(module, project.settings, front).panels,
      ),
    ]
    for (const panel of panels) {
      items.push({
        id: `C${moduleIndex + 1}-${suffix(panel.source)}`,
        moduleId: module.id,
        moduleName: module.name,
        part: panel.source.type,
        quantity: 1,
        length: panel.length,
        width: panel.width,
        thickness: panel.thickness,
      })
    }
  })
  return { available: true, items }
}
