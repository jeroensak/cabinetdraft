import type { CabinetModule } from '../cabinet/types'

/** Global construction dimensions are integer millimetres. */
export interface ProjectSettings {
  corpusThickness: number
  backPanelEnabled: boolean
  backPanelThickness: number
  frontThickness: number
  frontGap: number
}

export const PROJECT_SCHEMA_VERSION = 1

/** Persisted source of truth; deliberately contains no derived or editor state. */
export interface Project {
  schemaVersion: typeof PROJECT_SCHEMA_VERSION
  id: string
  name: string
  settings: ProjectSettings
  /** Array order is physical left-to-right order. */
  modules: CabinetModule[]
}
