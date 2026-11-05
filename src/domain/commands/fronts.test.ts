import { describe, expect, it } from 'vitest'
import { deriveCabinetGeometry } from '../cabinet/deriveCabinetGeometry'
import { deriveCutList } from '../cutlist/deriveCutList'
import { exportProject, parseProject } from '../import-export/projectJson'
import type { Project } from '../project/types'
import { deriveSpaces } from '../spaces/deriveSpaces'
import { CommandError } from './core'
import { addDividerToSpace } from './dividers'
import { duplicateModule } from './modules'
import { addDoor, setDoorLeaves, setDoorMount, removeFront } from './fronts'
import { addBoxlessFront } from './testHelpers'
import {
  fixture,
  freeze,
  fullRange,
  ids,
  rejects,
  structuralCodes,
} from './testHelpers'
import { validateProject } from '../validation/validateProject'

describe('front commands', () => {
  it.each([1, 2] as const)(
    'adds one semantic %s-leaf door over a contiguous multi-space range',
    (leaves) => {
      const project = fixture()
      project.modules[0]!.fronts = []
      const next = addDoor(
        freeze(project),
        project.modules[0]!.id,
        freeze(fullRange),
        leaves,
        ids(),
      )
      expect(next.modules[0]!.fronts).toStrictEqual([
        { id: 'new-1', type: 'door', leaves, ...fullRange },
      ])
      expect(validateProject(next)).toStrictEqual([])
    },
  )

  it('rejects overlapping door or drawer assignments', () => {
    const project = fixture()
    const module = project.modules[0]!
    const range = {
      ...fullRange,
      topBoundary: { type: 'shelf' as const, shelfId: module.shelves[0]!.id },
    }
    rejects(
      project,
      () => addDoor(project, module.id, range, 1, ids()),
      'structural-conflict',
    )
    expect(
      structuralCodes(() => addBoxlessFront(project, module.id, range, ids())),
    ).toContain('overlapping-fronts')
  })

  it('rejects drawer ranges spanning multiple spaces', () => {
    const project = fixture()
    project.modules[0]!.fronts = []
    expect(
      structuralCodes(() =>
        addBoxlessFront(
          freeze(project),
          project.modules[0]!.id,
          fullRange,
          ids(),
        ),
      ),
    ).toContain('drawer-must-cover-one-space')
  })

  it('rejects missing, reversed, and zero-length boundary ranges', () => {
    const project = fixture(true)
    const module = project.modules[0]!
    for (const range of [
      {
        ...fullRange,
        topBoundary: { type: 'shelf' as const, shelfId: 'missing' },
      },
      {
        bottomBoundary: fullRange.topBoundary,
        topBoundary: fullRange.bottomBoundary,
      },
      {
        bottomBoundary: fullRange.bottomBoundary,
        topBoundary: fullRange.bottomBoundary,
      },
    ])
      rejects(
        project,
        () => addDoor(project, module.id, range, 1, ids()),
        'structural-conflict',
      )
  })

  it('changes leaves without replacing the front or silently rounding an invalid width', () => {
    const project = addDoor(fixture(true), 'original-2', fullRange, 1, ids())
    project.modules[0]!.width = 801
    const next = setDoorLeaves(freeze(project), 'original-2', 'new-1', 2)
    expect(next.modules[0]!.fronts[0]).toStrictEqual({
      ...project.modules[0]!.fronts[0],
      leaves: 2,
    })
    expect(validateProject(next).map((issue) => issue.code)).toContain(
      'fractional-front-dimension',
    )
  })

  it('removes only the requested front', () => {
    const project = fixture()
    const module = project.modules[0]!
    const next = removeFront(freeze(project), module.id, module.fronts[0]!.id)
    expect(next.modules[0]!.fronts).toStrictEqual([])
    expect(next.modules[0]!.shelves).toStrictEqual(module.shelves)
  })

  it('rejects invalid leaf counts, drawers, and unknown front IDs', () => {
    const project = addBoxlessFront(
      fixture(true),
      'original-2',
      fullRange,
      ids(),
    )
    rejects(
      project,
      () => setDoorLeaves(project, 'original-2', 'new-1', 2),
      'not-a-door',
    )
    rejects(
      project,
      () => setDoorLeaves(project, 'original-2', 'missing', 2),
      'front-not-found',
    )
    rejects(
      project,
      () => removeFront(project, 'original-2', 'missing'),
      'front-not-found',
    )
    rejects(
      project,
      () => addDoor(project, 'original-2', fullRange, 3 as 1, ids()),
      'invalid-leaves',
    )
  })

  describe('door mount', () => {
    const inset = () => {
      const project = fixture()
      const module = project.modules[0]!
      return {
        project: setDoorMount(
          freeze(project),
          module.id,
          module.fronts[0]!.id,
          'inset',
        ),
        moduleId: module.id,
        doorId: module.fronts[0]!.id,
      }
    }
    const shelfPanel = (project: Project) =>
      deriveCabinetGeometry(project.modules[0]!, project.settings).panels.find(
        (panel) => panel.source.type === 'shelf',
      )!

    it('sets a shelf behind an inset door back by the door and the gap', () => {
      const { project } = inset()
      expect(shelfPanel(project)).toMatchObject({
        width: 577,
        position: { z: 20 },
      })
      expect(validateProject(project)).toStrictEqual([])
    })

    it('restores the shelf and stores nothing when going back to overlay', () => {
      const { project, moduleId, doorId } = inset()
      const overlay = setDoorMount(project, moduleId, doorId, 'overlay')
      expect(overlay.modules[0]!.fronts[0]).not.toHaveProperty('mount')
      expect(shelfPanel(overlay)).toMatchObject({
        width: 597,
        position: { z: 0 },
      })
    })

    it('leaves a shelf bounding the door where it is', () => {
      const project = fixture()
      const module = project.modules[0]!
      const shelfId = module.shelves[0]!.id
      module.fronts = []
      const bounded = addDoor(
        project,
        module.id,
        {
          bottomBoundary: { type: 'shelf', shelfId },
          topBoundary: { type: 'module-top' },
        },
        1,
        ids(),
      )
      const door = bounded.modules[0]!.fronts[0]!
      const next = setDoorMount(bounded, module.id, door.id, 'inset')
      expect(shelfPanel(next)).toMatchObject({ width: 597 })
    })

    it('sets back a divider inside the door opening', () => {
      const { project, moduleId } = inset()
      const module = project.modules[0]!
      const space = deriveSpaces(module, project.settings)[0]!
      const divided = addDividerToSpace(project, moduleId, space, ids())
      const panel = deriveCabinetGeometry(
        divided.modules[0]!,
        divided.settings,
      ).panels.find((item) => item.source.type === 'divider')!
      expect(panel).toMatchObject({ width: 577, position: { z: 20 } })
    })

    it('stays inset when its cabinet is duplicated', () => {
      const { project, moduleId } = inset()
      const copy = duplicateModule(project, moduleId, ids()).modules[1]!
      expect(copy.fronts[0]).toMatchObject({ mount: 'inset' })
    })

    it('feeds the cut list and survives export and import', () => {
      const { project } = inset()
      const result = deriveCutList(project)
      if (!result.available) throw new Error('expected a cut list')
      expect(result.items.find((item) => item.part === 'shelf')).toMatchObject({
        width: 577,
      })
      expect(
        result.items
          .filter((item) => item.part === 'door')
          .map((item) => [item.length, item.width]),
      ).toStrictEqual([
        [2160, 379],
        [2160, 379],
      ])
      expect(parseProject(exportProject(project))).toStrictEqual(project)
    })

    it('rejects an unknown mount on import and a door that does not exist', () => {
      const { project, moduleId } = inset()
      const raw = JSON.parse(exportProject(project))
      raw.modules[0].fronts[0].mount = 'floating'
      expect(() => parseProject(JSON.stringify(raw))).toThrow(
        'invalid-structure',
      )
      expect(() => setDoorMount(project, moduleId, 'missing', 'inset')).toThrow(
        CommandError,
      )
    })
  })
})
