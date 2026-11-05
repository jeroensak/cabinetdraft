import type { Project } from '../domain/project/types'
import { projectData } from '../domain/project/projectData'

export const DESIGN_LIBRARY_KEY = 'cabinet-designer:designs:v1'

export interface DesignSummary {
  id: string
  name: string
}
/** The working copy of the open design lives under the project key. A design
 * stays here while open, so a stale second tab can't erase its only copy. */
export interface StoredDesign extends DesignSummary {
  project: unknown
}

function isStoredDesign(value: unknown): value is StoredDesign {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as StoredDesign).id === 'string' &&
    typeof (value as StoredDesign).name === 'string' &&
    'project' in value
  )
}

/** Null means unreadable: callers must then leave the stored data untouched. */
export function readLibrary(storage: {
  getItem(key: string): string | null
}): StoredDesign[] | null {
  try {
    const raw = storage.getItem(DESIGN_LIBRARY_KEY)
    if (raw === null) return []
    const value: unknown = JSON.parse(raw)
    return Array.isArray(value) && value.every(isStoredDesign) ? value : null
  } catch {
    return null
  }
}

/** Replaces a design in place, keeping the order of the dropdown stable. */
export function withDesign(
  library: StoredDesign[],
  project: Project,
): StoredDesign[] {
  const entry = {
    id: project.id,
    name: project.name,
    project: projectData(project),
  }
  return library.some((design) => design.id === project.id)
    ? library.map((design) => (design.id === project.id ? entry : design))
    : [...library, entry]
}

export const summaries = (library: StoredDesign[] | null) =>
  library?.map(({ id, name }) => ({ id, name })) ?? null
