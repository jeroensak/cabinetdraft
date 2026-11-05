import type { CutListItem } from '../domain/cutlist/deriveCutList'
import { t } from '../i18n'

export function partName(item: CutListItem): string {
  const name = t(`part.${item.part}`)
  if (item.groove) return t('part.withGroove', { ...item.groove, name })
  return item.waveDip === undefined
    ? name
    : t('part.withWave', { name, dip: item.waveDip })
}
