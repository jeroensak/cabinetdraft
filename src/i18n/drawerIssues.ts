import type { DrawerIssue } from '../domain/drawers/deriveDrawerGeometry'
import { formatMeasure, type MeasurementUnit } from '../units'
import { t } from './index'

/** Domain issues carry a reason and data; the wording lives in the locales. */
export function drawerIssueMessage(
  { reason, values = {} }: DrawerIssue,
  unit: MeasurementUnit,
) {
  const size = (value: string | number | undefined) =>
    formatMeasure(Number(value), unit)
  if (reason === 'measurement')
    return t('drawerIssue.measurement', {
      minimum: size(values.minimum),
      field: t(`drawerField.${values.field}` as 'drawerField.depth'),
    })
  if (reason === 'panel-size')
    return t('drawerIssue.panel-size', {
      part: t(`part.${values.part}` as 'part.drawer'),
      dimension: t(`dimension.${values.dimension}` as 'dimension.width'),
      unit: t(unit === 'inch' ? 'unit.inchPlural' : 'unit.mmPlural'),
    })
  if (reason === 'height-overflow')
    return t('drawerIssue.height-overflow', {
      total: size(values.total),
      opening: size(values.opening),
    })
  if (reason === 'depth-overflow' || reason === 'inset-depth-overflow')
    return t(`drawerIssue.${reason}`, {
      total: size(values.total),
      carcass: size(values.carcass),
    })
  return t(`drawerIssue.${reason}`)
}
