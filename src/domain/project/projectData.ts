import type { Boundary } from '../fronts/types'
import type { Project } from './types'

function boundaryData(boundary: Boundary): Boundary {
  return boundary.type === 'shelf'
    ? { type: 'shelf', shelfId: boundary.shelfId }
    : { type: boundary.type }
}

/** Copy only the persisted schema. Preserve values, including invalid geometry. */
export function projectData(project: Project): Project {
  return {
    schemaVersion: project.schemaVersion,
    id: project.id,
    name: project.name,
    settings: {
      corpusThickness: project.settings.corpusThickness,
      backPanelEnabled: project.settings.backPanelEnabled,
      backPanelThickness: project.settings.backPanelThickness,
      frontThickness: project.settings.frontThickness,
      frontGap: project.settings.frontGap,
    },
    modules: project.modules.map((module) => ({
      id: module.id,
      name: module.name,
      width: module.width,
      height: module.height,
      depth: module.depth,
      shelves: module.shelves.map((shelf) => ({
        id: shelf.id,
        bottom: shelf.bottom,
      })),
      fronts: module.fronts.map((front) => {
        const common = {
          bottomBoundary: boundaryData(front.bottomBoundary),
          topBoundary: boundaryData(front.topBoundary),
        }
        return front.type === 'door'
          ? { id: front.id, type: 'door', ...common, leaves: front.leaves }
          : { id: front.id, type: 'drawer', ...common }
      }),
    })),
  }
}
