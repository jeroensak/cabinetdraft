import type { DrawerDesign } from '../drawers/types'
import type { CabinetModule } from '../cabinet/types'

/** Global construction dimensions are integer millimetres. */
import type { MeasurementUnit } from './units'

export interface ProjectSettings {
  /** Fixed when a design is created. Omitted means mm; 'inch' means every
   * measurement in this project is a whole number of 1/32 inch units. */
  unit?: MeasurementUnit
  corpusThickness: number
  backPanelEnabled: boolean
  backPanelThickness: number
  frontThickness: number
  frontGap: number
}

export const PROJECT_SCHEMA_VERSION = 6

/** Persisted source of truth; deliberately contains no derived or editor state. */
export interface Project {
  schemaVersion: typeof PROJECT_SCHEMA_VERSION
  id: string
  name: string
  settings: ProjectSettings
  drawerDesigns: DrawerDesign[]
  /** Array order is physical left-to-right order. */
  modules: CabinetModule[]
}
