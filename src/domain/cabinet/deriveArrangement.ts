import type { Project } from '../project/types'
import { deriveCabinetGeometry } from './deriveCabinetGeometry'

/** Physical arrangement only: origins follow array order, with common front/bottom. */
export function deriveArrangement(project: Project) {
  let totalWidth = 0
  const modules = project.modules.map((module) => {
    const origin = { x: totalWidth, y: 0, z: 0 }
    totalWidth += module.width
    return {
      module,
      origin,
      geometry: deriveCabinetGeometry(module, project.settings),
    }
  })
  return {
    modules,
    totalWidth,
    maximumHeight: Math.max(
      0,
      ...project.modules.map((module) => module.height),
    ),
  }
}
export type Arrangement = ReturnType<typeof deriveArrangement>
