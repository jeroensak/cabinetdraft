import type { CabinetModule } from '../cabinet/types'
import type { Project } from '../project/types'
import { deriveDrawerGeometry } from './deriveDrawerGeometry'

/** Box panels only; the existing front pipeline produces the sixth panel exactly once. */
export function deriveModuleDrawerPanels(
  project: Project,
  module: CabinetModule,
) {
  return module.fronts.flatMap((front) => {
    if (front.type !== 'drawer' || front.drawerDesignId === undefined) return []
    const design = project.drawerDesigns.find(
      (d) => d.id === front.drawerDesignId,
    )
    return design
      ? deriveDrawerGeometry(module, project.settings, front, design).boxPanels
      : []
  })
}
