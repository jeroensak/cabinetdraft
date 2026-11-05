import { describe, expect, it } from 'vitest'
import { designTemplates } from '../design-templates'
import {
  exportProject,
  parseProject,
} from '../domain/import-export/projectJson'
import { convertToInches } from '../domain/project/convertToInches'
import { createDefaultProject } from '../domain/project/createDefaultProject'
import { hasSharedDesign, readSharedDesign, shareHash } from './shareLink'

async function hashFor(text: string) {
  const stream = new Blob([text])
    .stream()
    .pipeThrough(new CompressionStream('gzip'))
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer())
  return `#design=${btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')}`
}

describe('share links', () => {
  it('round-trips a design exactly, including an inch design', async () => {
    for (const project of [
      createDefaultProject(),
      convertToInches(createDefaultProject()),
    ]) {
      const hash = await shareHash(project)
      expect(hasSharedDesign(hash)).toBe(true)
      expect(await readSharedDesign(hash)).toStrictEqual(project)
    }
  })

  it('stays short and URL-safe for a large template', async () => {
    const hash = await shareHash(parseProject(designTemplates[1]!.raw))
    expect(hash).toMatch(/^#design=[\w-]+$/)
    expect(hash.length).toBeLessThan(2500)
  })

  it('ignores other fragments', () => {
    expect(hasSharedDesign('')).toBe(false)
    expect(hasSharedDesign('#section')).toBe(false)
  })

  it('rejects garbage and valid JSON that is not a design', async () => {
    await expect(readSharedDesign('#design=not-a-design')).rejects.toThrow()
    await expect(
      readSharedDesign(await hashFor('{"schemaVersion":6}')),
    ).rejects.toThrow()
    const project = JSON.parse(exportProject(createDefaultProject()))
    project.modules[0].width = 'wide'
    await expect(
      readSharedDesign(await hashFor(JSON.stringify(project))),
    ).rejects.toThrow()
  })

  it('refuses a link that expands to an unreasonable size', async () => {
    await expect(
      readSharedDesign(await hashFor(' '.repeat(6_000_000))),
    ).rejects.toThrow('too large')
  })
})
