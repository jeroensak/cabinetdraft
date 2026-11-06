import type { ProjectSettings } from '../project/types'
import type { CutListItem } from './deriveCutList'

export type BandedEdges = 'none' | 'front' | 'all'

/** Every part is listed so a new part type can't go unbanded by accident. */
const bandedEdges: Record<CutListItem['part'], BandedEdges> = {
  'side-left': 'front',
  'side-right': 'front',
  top: 'front',
  bottom: 'front',
  shelf: 'front',
  divider: 'front',
  door: 'all',
  drawer: 'all',
  back: 'none',
  'drawer-side-left': 'none',
  'drawer-side-right': 'none',
  'drawer-box-front': 'none',
  'drawer-box-back': 'none',
  'drawer-bottom': 'none',
}

/** A wave top is banded as if straight, plus this share to cover the curve. */
const WAVE_ALLOWANCE = 1.25

/** One canonical row, or several identical parts merged under a quantity. */
export type BandingRow = Pick<
  CutListItem,
  'part' | 'length' | 'width' | 'waveDip'
> & { quantity: number }

/** The band's thickness counts only while banding is on. */
export const bandThickness = (settings: ProjectSettings) =>
  settings.edgeBanding ? (settings.edgeBandingThickness ?? 0) : 0

/** The size to saw so the part reaches its designed size once banded. A front
 * edge runs along Length, so its band takes from Width; all four edges take
 * twice from both. Only a single front edge can leave a half unit. */
export function bandedCutSize(
  part: CutListItem['part'],
  length: number,
  width: number,
  thickness: number,
) {
  const edges = bandedEdges[part]
  return {
    length: edges === 'all' ? length - 2 * thickness : length,
    width:
      edges === 'all'
        ? width - 2 * thickness
        : edges === 'front'
          ? width - thickness
          : width,
  }
}

export interface RowBanding {
  edges: BandedEdges
  /** The length includes the wave top allowance. */
  waveAllowance: boolean
  /** Band needed for the whole row, along its cut sizes. A wave allowance can
   * end in a half unit, always exactly, because a front's cut perimeter is an
   * even whole number. */
  length: number
}

export interface EdgeBanding {
  thickness: number
  rows: RowBanding[]
  totalLength: number
}

/** A panel's Length always runs along its front edge: see specification
 * section 32, and PanelOrientation, where Width is the depth for these parts. */
export function deriveRowBanding(row: BandingRow): RowBanding {
  const edges = bandedEdges[row.part]
  const waveAllowance = edges === 'all' && row.waveDip !== undefined
  const perPart =
    edges === 'none'
      ? 0
      : edges === 'front'
        ? row.length
        : (2 * row.length + 2 * row.width) *
          (waveAllowance ? WAVE_ALLOWANCE : 1)
  return { edges, waveAllowance, length: perPart * row.quantity }
}

/** Null while the project's setting is off. Merged and separate rows of the
 * same parts give the same total. */
export function deriveEdgeBanding(
  settings: ProjectSettings,
  rows: readonly BandingRow[],
): EdgeBanding | null {
  if (!settings.edgeBanding) return null
  const banding = rows.map(deriveRowBanding)
  return {
    thickness: bandThickness(settings),
    rows: banding,
    totalLength: banding.reduce((total, row) => total + row.length, 0),
  }
}
