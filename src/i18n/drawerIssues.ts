import type { DrawerIssue } from '../domain/drawers/deriveDrawerGeometry'
import { t } from './index'

/** Domain issues carry a reason and data; the wording lives in the locales. */
export function drawerIssueMessage({ reason, values = {} }: DrawerIssue) {
  if (reason === 'measurement')
    return t('drawerIssue.measurement', {
      ...values,
      field: t(`drawerField.${values.field}` as 'drawerField.depth'),
    })
  if (reason === 'panel-size')
    return t('drawerIssue.panel-size', {
      part: t(`part.${values.part}` as 'part.drawer'),
      dimension: t(`dimension.${values.dimension}` as 'dimension.width'),
    })
  return t(`drawerIssue.${reason}`, values)
}
