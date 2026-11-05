// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DrawerGeometry } from '../domain/drawers/deriveDrawerGeometry'
import { createDefaultProject } from '../domain/project/createDefaultProject'
import { useProjectStore } from '../store/projectStore'
import { DrawerPreview } from './DrawerPreview'

afterEach(cleanup)
beforeEach(() => {
  useProjectStore.setState({ present: createDefaultProject() })
})

// A front the exact size of the cabinet, standing 18 mm in front of it.
const geometry = {
  width: 500,
  height: 200,
  depth: 400,
  openingWidth: 564,
  carcassDepth: 500,
  gaps: { side: 5, bottom: 14, top: 7, rear: 3 },
  opening: { left: 18, right: 582, bottom: 18, top: 382 },
  boxPanels: [],
  standaloneFrontPanels: [
    {
      moduleId: 'module',
      source: { type: 'drawer', frontId: 'front' },
      orientation: 'face',
      length: 400,
      width: 600,
      thickness: 18,
      position: { x: 0, y: 0, z: -18 },
    },
  ],
} as unknown as DrawerGeometry

const frontFaces = (open: boolean) => {
  const { container } = render(
    <DrawerPreview geometry={geometry} showFront open={open} />,
  )
  return [...container.querySelectorAll('[data-source="drawer"]')]
}

describe('Drawer preview', () => {
  it('draws a closed overlay front straight-on against the cabinet face', () => {
    const faces = frontFaces(false)
    expect(faces).toHaveLength(1)
    expect(faces[0].getAttribute('points')).toBe('0,0 600,0 600,-400 0,-400')
  })

  it('keeps the angled view for an opened front', () => {
    const faces = frontFaces(true)
    expect(faces).toHaveLength(3)
    expect(faces[0].getAttribute('points')).not.toBe(
      '0,0 600,0 600,-400 0,-400',
    )
  })
})
