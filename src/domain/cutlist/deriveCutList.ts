import { deriveModuleDrawerPanels } from '../drawers/deriveModuleDrawerPanels'
import { frontDesign } from '../drawers/types'
import { deriveCabinetGeometry } from '../cabinet/deriveCabinetGeometry'
import { deriveFrontGeometry } from '../fronts/deriveFrontGeometry'
import type {
  PanelGroove,
  PanelSource,
  PhysicalPanel,
} from '../geometry/physicalPanel'
import type { Project } from '../project/types'
import { bandedCutSize, bandThickness } from './edgeBanding'
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
  /** Wave top fronts are cut from this blank, then dip this far at mid-width. */
  waveDip?: number
  /** Drawer walls: the groove that holds the bottom. */
  groove?: PanelGroove
}

export type CutListResult =
  | { available: true; items: CutListItem[] }
  | { available: false; issues: ValidationIssue[] }

export interface LabelledPanel {
  id: string
  moduleId: string
  moduleName: string
  panel: PhysicalPanel
}

/** Every physical panel with its cut-list identifier, for any consumer that has
 * to name the same parts as the cut list. */
export function deriveLabelledPanels(project: Project): LabelledPanel[] {
  const labelled: LabelledPanel[] = []
  project.modules.forEach((module, moduleIndex) => {
    const shelves = [...module.shelves].sort((a, b) => a.bottom - b.bottom)
    const doors = module.fronts.filter((front) => front.type === 'door')
    const drawers = module.fronts.filter((front) => front.type === 'drawer')
    const carcassPanels = deriveCabinetGeometry(module, project.settings).panels
    const dividerPanels = carcassPanels
      .filter((panel) => panel.source.type === 'divider')
      .sort(
        (a, b) => a.position.y - b.position.y || a.position.x - b.position.x,
      )
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
        case 'divider':
          return `DIVIDER-${dividerPanels.findIndex((panel) => panel.source.type === 'divider' && panel.source.dividerId === source.dividerId) + 1}`
        case 'door':
          return `DOOR-${doors.findIndex((front) => front.id === source.frontId) + 1}${source.leaf === 'single' ? '' : source.leaf === 'left' ? '-L' : '-R'}`
        case 'drawer-side-left':
        case 'drawer-side-right':
        case 'drawer-box-front':
        case 'drawer-box-back':
        case 'drawer-bottom':
          return `DRAWER-${drawers.findIndex((front) => front.id === source.frontId) + 1}-${{ 'drawer-side-left': 'SIDE-L', 'drawer-side-right': 'SIDE-R', 'drawer-box-front': 'BOX-FRONT', 'drawer-box-back': 'BOX-BACK', 'drawer-bottom': 'BOTTOM' }[source.type]}`
        case 'drawer':
          return `DRAWER-${drawers.findIndex((front) => front.id === source.frontId) + 1}`
      }
    }
    const panels = [
      ...carcassPanels,
      ...deriveModuleDrawerPanels(project, module),
      ...module.fronts.flatMap(
        (front) =>
          deriveFrontGeometry(
            module,
            project.settings,
            front,
            frontDesign(project.drawerDesigns, front),
          ).panels,
      ),
    ]
    for (const panel of panels) {
      labelled.push({
        id: `C${moduleIndex + 1}-${suffix(panel.source)}`,
        moduleId: module.id,
        moduleName: module.name,
        panel,
      })
    }
  })
  return labelled
}

/** Independent domain consumer; invalid projects expose no manufacturing rows. */
export function deriveCutList(project: Project): CutListResult {
  const issues = validateProject(project)
  if (issues.length > 0) return { available: false, issues }
  const band = bandThickness(project.settings)
  return {
    available: true,
    items: deriveLabelledPanels(project).map(
      ({ id, moduleId, moduleName, panel }) => ({
        id,
        moduleId,
        moduleName,
        part: panel.source.type,
        quantity: 1,
        ...bandedCutSize(panel.source.type, panel.length, panel.width, band),
        thickness: panel.thickness,
        ...(panel.waveDip !== undefined ? { waveDip: panel.waveDip } : {}),
        ...(panel.groove ? { groove: panel.groove } : {}),
      }),
    ),
  }
}
