import type { CutListItem } from '../domain/cutlist/deriveCutList'
import type { MeasurementUnit } from '../domain/project/units'
import { t } from '../i18n'
import { formatBare, formatMeasure } from '../units'

export function partName(
  item: CutListItem,
  unit: MeasurementUnit = 'mm',
): string {
  const name = t(`part.${item.part}`)
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
