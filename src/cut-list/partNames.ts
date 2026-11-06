import type { CutListItem } from '../domain/cutlist/deriveCutList'
import type { MeasurementUnit } from '../domain/project/units'
import { t } from '../i18n'
import type { BandingRow, EdgeBanding } from '../domain/cutlist/edgeBanding'
import { deriveRowBanding } from '../domain/cutlist/edgeBanding'
import { formatBare, formatMeasure } from '../units'

const isDrawerSide = (item: CutListItem) =>
  item.part === 'drawer-side-left' || item.part === 'drawer-side-right'

const isTopOrBottom = (item: CutListItem) =>
  item.part === 'top' || item.part === 'bottom'

export function partName(
  item: CutListItem,
  unit: MeasurementUnit = 'mm',
  /** Once rows are merged, left and right drawer sides are the same panel, and
   * so are a cabinet's top and bottom. */
  merged = false,
): string {
  const name = !merged
    ? t(`part.${item.part}`)
    : isDrawerSide(item)
      ? t('part.drawer-side')
      : isTopOrBottom(item)
        ? t('part.top-bottom')
        : t(`part.${item.part}`)
  if (item.groove)
    return t('part.withGroove', {
      name,
      width:
        unit === 'inch'
          ? formatMeasure(item.groove.width, unit)
          : formatBare(item.groove.width, unit),
      depth:
        unit === 'inch'
          ? formatMeasure(item.groove.depth, unit)
          : formatBare(item.groove.depth, unit),
      fromEdge: formatMeasure(item.groove.fromEdge, unit),
    })
  return item.waveDip === undefined
    ? name
    : t('part.withWave', { name, dip: formatMeasure(item.waveDip, unit) })
}

/** The banded edges of a row, in the words of the cut list column. */
export function bandedEdgesLabel(row: BandingRow): string {
  const { edges, waveAllowance } = deriveRowBanding(row)
  if (edges === 'none') return t('cutList.bandingNone')
  if (edges === 'front') return t('cutList.bandingFront')
  return t(waveAllowance ? 'cutList.bandingAllWave' : 'cutList.bandingAll')
}

/** What the total includes, and that cut sizes are unaffected. */
export function bandingNote(banding: EdgeBanding): string {
  return banding.rows.some((row) => row.waveAllowance)
    ? `${t('cutList.bandingWaveNote')} ${t('cutList.bandingNote')}`
    : t('cutList.bandingNote')
}
