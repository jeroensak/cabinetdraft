import { parseProject } from '../domain/import-export/projectJson'

const files = import.meta.glob<string>('./*.json', {
  query: '?raw',
  import: 'default',
  eager: true,
})

export interface DesignTemplate {
  id: string
  name: string
  raw: string
}

/** Every exported project in this folder, in file name order. */
export const designTemplates: DesignTemplate[] = Object.keys(files)
  .sort()
  .flatMap((path) => {
    try {
      const raw = files[path]!
      return [{ id: path, name: parseProject(raw).name, raw }]
    } catch {
      // A broken file must never stop the app; the test suite reports it.
      return []
    }
  })
