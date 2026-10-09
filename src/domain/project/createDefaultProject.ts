import { DEFAULT_MODULE_DIMENSIONS } from './defaults'
import { createId, type IdGenerator } from './id'
import { PROJECT_SCHEMA_VERSION, type Project } from './types'

/** Inject IDs to make project creation deterministic in tests or other callers. */
export function createDefaultProject(
  generateId: IdGenerator = createId,
): Project {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: generateId(),
    name: 'Untitled cabinet',
    settings: {
      corpusThickness: 18,
      backPanelEnabled: true,
      backPanelThickness: 3,
      frontThickness: 18,
      frontGap: 2,
    },
    modules: [
      {
        id: generateId(),
        name: 'Cabinet 1',
        ...DEFAULT_MODULE_DIMENSIONS,
        // Frozen specification §5: this position gives equal free heights.
        shelves: [{ id: generateId(), bottom: 1091 }],
        fronts: [
          {
            id: generateId(),
            type: 'door',
            bottomBoundary: { type: 'module-bottom' },
            topBoundary: { type: 'module-top' },
            leaves: 2,
          },
        ],
      },
    ],
  }
}
