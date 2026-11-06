import {
  exportProject,
  parseProject,
} from '../domain/import-export/projectJson'
import type { Project } from '../domain/project/types'
import { t } from '../i18n'

const files = import.meta.glob<string>('./*.json', {
  query: '?raw',
  import: 'default',
  eager: true,
})

export interface DesignTemplate {
  id: string
  key: 'template.1' | 'template.2' | 'template.3' | 'template.4' | 'template.5'
  name: string
  raw: string
}

/** Every exported project in this folder, in file name order. */
export const designTemplates: DesignTemplate[] = Object.keys(files)
  .sort()
  .flatMap((path, index) => {
    try {
      const raw = files[path]!
      const key = `template.${index + 1}` as DesignTemplate['key']
      return [{ id: path, key, name: parseProject(raw).name, raw }]
    } catch {
      // A broken file must never stop the app; the test suite reports it.
      return []
    }
  })

const textKey = (name: string) =>
  `templateText.${name}` as 'templateText.Wide cabinet'

/** Names inside a template read in the current language; unlisted names stay. */
export function localizedTemplate(raw: string): string {
  const project: Project = parseProject(raw)
  const label = <T extends { name: string }>(item: T) => ({
    ...item,
    name: t(textKey(item.name), { defaultValue: item.name }),
  })
  return exportProject({
    ...project,
    modules: project.modules.map(label),
    drawerDesigns: project.drawerDesigns.map(label),
  })
}
