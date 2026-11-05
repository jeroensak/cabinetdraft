import type { Project } from '../domain/project/types'

export function uniqueDesignName(project: Project, base: string) {
  const names = new Set(project.drawerDesigns.map((design) => design.name))
  if (!names.has(base)) return base
  let index = 2
  while (names.has(`${base} ${index}`)) index++
  return `${base} ${index}`
}
