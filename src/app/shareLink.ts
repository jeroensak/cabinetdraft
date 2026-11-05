import {
  exportProject,
  parseProject,
} from '../domain/import-export/projectJson'
import type { Project } from '../domain/project/types'

const PREFIX = '#design='
/** Far beyond any real design; stops a crafted link from expanding endlessly. */
const MAX_DESIGN_BYTES = 5_000_000

async function collect(stream: ReadableStream<Uint8Array>) {
  const chunks: Uint8Array[] = []
  let size = 0
  const reader = stream.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.length
    if (size > MAX_DESIGN_BYTES) {
      await reader.cancel()
      throw new Error('Shared design is too large')
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  return bytes
}

const piped = (bytes: Uint8Array, transform: ReadableWritablePair) =>
  new Blob([bytes as BlobPart]).stream().pipeThrough(transform)

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')

const fromBase64Url = (text: string) =>
  Uint8Array.from(atob(text.replaceAll('-', '+').replaceAll('_', '/')), (c) =>
    c.charCodeAt(0),
  )

/** The design travels after the #, which browsers never send to a server. */
export async function shareHash(project: Project): Promise<string> {
  const json = new TextEncoder().encode(exportProject(project))
  const gzipped = await collect(piped(json, new CompressionStream('gzip')))
  return PREFIX + toBase64Url(gzipped)
}

export const hasSharedDesign = (hash: string) => hash.startsWith(PREFIX)

/** Passes the same boundary as an imported file, and throws if it isn't valid. */
export async function readSharedDesign(hash: string): Promise<Project> {
  const gzipped = fromBase64Url(hash.slice(PREFIX.length))
  const json = await collect(piped(gzipped, new DecompressionStream('gzip')))
  return parseProject(new TextDecoder().decode(json))
}
