import type { Project } from './types'
import { minDrawerSideClearance } from '../drawers/types'
import { mmToInchUnits } from './units'

/** Sheet thicknesses land on 1/8", everything else on 1/16". */
const THICKNESS_GRID = 4
const SIZE_GRID = 2
const thickness = (mm: number) => mmToInchUnits(mm, THICKNESS_GRID)
const size = (mm: number) => mmToInchUnits(mm, SIZE_GRID)

/** One-way and only for starting a new design: it rounds to workshop sizes, so
 * converting a design someone already works on would silently change it. */
export function convertToInches(project: Project): Project {
  const { settings } = project
  if (settings.unit === 'inch') return project
  return {
    ...project,
    settings: {
      ...settings,
      unit: 'inch',
      corpusThickness: thickness(settings.corpusThickness),
      backPanelThickness: thickness(settings.backPanelThickness),
      frontThickness: thickness(settings.frontThickness),
      frontGap: size(settings.frontGap),
    },
    drawerDesigns: project.drawerDesigns.map((design) => ({
      ...design,
      wallThickness: thickness(design.wallThickness),
      bottomThickness: thickness(design.bottomThickness),
      depth: size(design.depth),
      sideClearance: Math.max(
        size(design.sideClearance),
        minDrawerSideClearance('inch'),
      ),
      bottomClearance: size(design.bottomClearance),
      topClearance: size(design.topClearance),
      rearClearance: size(design.rearClearance),
      bottomRecess: size(design.bottomRecess),
    })),
    modules: project.modules.map((module) => ({
      ...module,
      width: size(module.width),
      height: size(module.height),
      depth: size(module.depth),
      shelves: module.shelves.map((shelf) => ({
        ...shelf,
        bottom: size(shelf.bottom),
      })),
      dividers: module.dividers.map((divider) => ({
        ...divider,
        left: size(divider.left),
      })),
    })),
  }
}
