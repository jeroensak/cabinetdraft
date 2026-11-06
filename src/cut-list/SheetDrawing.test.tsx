// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { SheetPart } from '../domain/cutlist/sheetLayout'
import { SheetDrawing } from './SheetDrawing'

afterEach(cleanup)

const part = (overrides: Partial<SheetPart>): SheetPart => ({
  id: 'C1-TOP',
  part: 'top',
  moduleName: 'Cabinet 1',
  x: 0,
  y: 0,
  spanX: 1000,
  spanY: 600,
  ...overrides,
})
const STOCK = { length: 2440, width: 1220, kerf: 4 }

function draw(
  parts: SheetPart[],
  cuts: Parameters<typeof SheetDrawing>[0]['sheet']['cuts'] = [],
) {
  return render(
    <SheetDrawing
      sheet={{ parts, cuts }}
      stock={STOCK}
      unit="mm"
      label="Sheet 1"
    />,
  ).container
}

describe('SheetDrawing', () => {
  it('draws to scale in the units of the sheet', () => {
    const container = draw([part({ x: 10, y: 20 })])
    expect(screen.getByRole('img', { name: 'Sheet 1' })).toHaveAttribute(
      'viewBox',
      '0 0 2440 1220',
    )
    const rect = container.querySelector('.sheet-part')!
    expect(rect).toHaveAttribute('x', '10')
    expect(rect).toHaveAttribute('width', '1000')
    expect(rect).toHaveAttribute('data-group', 'bases')
    expect(rect.querySelector('title')).toHaveTextContent('C1-TOP · 1000 × 600')
  })

  it('runs a cut through the middle of the blade, inside the sheet', () => {
    const cut = { order: 1, axis: 'x' as const, from: 0, to: 1220 }
    const middle = draw([part({})], [{ ...cut, position: 1000 }])
    expect(middle.querySelector('.sheet-cut line')).toHaveAttribute(
      'x1',
      '1002',
    )
    cleanup()
    const sliver = draw([part({})], [{ ...cut, position: 2439 }])
    expect(sliver.querySelector('.sheet-cut line')).toHaveAttribute(
      'x1',
      '2440',
    )
  })

  it('turns a label along a tall part and drops the size on a thin one', () => {
    const tall = draw([part({ spanX: 150, spanY: 1000 })])
    expect(tall.querySelector('.sheet-part-label')).toHaveAttribute(
      'transform',
      expect.stringContaining('rotate(-90)'),
    )
    cleanup()
    const thin = draw([part({ spanX: 1000, spanY: 40 })])
    expect(thin.querySelector('.sheet-part-label')).toHaveTextContent(
      /^C1-TOP$/,
    )
  })

  it('leaves a part too small to read to its title', () => {
    const container = draw([part({ spanX: 8, spanY: 8 })])
    expect(container.querySelector('.sheet-part-label')).toBeNull()
    expect(container.querySelector('.sheet-part title')).toBeInTheDocument()
  })
})
