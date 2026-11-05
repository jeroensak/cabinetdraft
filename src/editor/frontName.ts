import type { Front } from '../domain/fronts/types'
import { t } from '../i18n'

export function frontName(front: Front) {
  return front.type === 'drawer'
    ? t('front.drawer')
    : front.leaves === 2
      ? t('front.double')
      : t('front.single')
}
