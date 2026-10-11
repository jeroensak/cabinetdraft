import { isProject } from './schema'
import { projectData } from '../project/projectData'
import { PROJECT_SCHEMA_VERSION, type Project } from '../project/types'
import { editProject } from '../commands/core'

export class ProjectImportError extends Error {
  readonly code: 'malformed-json' | 'unsupported-version' | 'invalid-structure'
  constructor(
    code: 'malformed-json' | 'unsupported-version' | 'invalid-structure',
  ) {
    super(code)
    this.code = code
  }
}

/** Explicit version dispatch: add version-specific migrations here when needed. */
function migrateProject(value: unknown): Project {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('schemaVersion' in value)
  )
    throw new ProjectImportError('invalid-structure')
  if (value.schemaVersion !== PROJECT_SCHEMA_VERSION)
    throw new ProjectImportError('unsupported-version')
  if (!isProject(value)) throw new ProjectImportError('invalid-structure')
  const project = projectData(value)
  if (
    [
      project.id,
      ...project.modules.flatMap((module) => [
        module.id,
        ...module.shelves.map((s) => s.id),
        ...module.fronts.map((f) => f.id),
      ]),
    ].some((id) => !id.trim())
  )
    throw new ProjectImportError('invalid-structure')
  try {
    // The same structural invariants as commands; geometric errors remain valid input.
    return editProject(project, () => {})
  } catch {
    throw new ProjectImportError('invalid-structure')
  }
}

export function parseProject(raw: string): Project {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    throw new ProjectImportError('malformed-json')
  }
  return migrateProject(value)
}

export function exportProject(project: Project): string {
  return JSON.stringify(projectData(project), null, 2) + '\n'
}

export function projectFilename(name: string): string {
  const stem = name
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100)
  return `${stem || 'cabinet-project'}.json`
}
