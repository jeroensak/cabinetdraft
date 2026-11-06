import { useState } from 'react'
import { CommandError } from '../domain/commands'
import type { DrawerIssue } from '../domain/drawers/deriveDrawerGeometry'
import { t } from '../i18n'
import { drawerIssueMessage } from '../i18n/drawerIssues'
import { useProjectStore } from '../store/projectStore'

export function commandMessage(error: unknown) {
  if (!(error instanceof CommandError)) throw error
  if (error.code === 'structural-conflict') return t('error.structuralConflict')
  if (error.code === 'invalid-integer') return t('field.wholeMm')
  if (error.code === 'invalid-band-thickness')
    return t(
      useProjectStore.getState().present.settings.unit === 'inch'
        ? 'field.halfInches'
        : 'field.halfMm',
    )
  if (error.code === 'slot-too-narrow') return t('error.slotTooNarrow')
  if (error.code === 'divider-in-use') return t('error.dividerInUse')
  if (error.code === 'shelf-has-dividers') return t('error.shelfHasDividers')
  if (
    error.code === 'invalid-drawer-design' ||
    error.code === 'drawer-does-not-fit'
  ) {
    const issue = (error.data.issues as DrawerIssue[] | undefined)?.[0]
    return issue
      ? drawerIssueMessage(
          issue,
          useProjectStore.getState().present.settings.unit ?? 'mm',
        )
      : t('error.drawerNoFit')
  }
  if (error.code === 'drawer-design-in-use') return t('error.designInUse')
  if (error.code === 'space-occupied') return t('error.spaceOccupied')
  if (error.code === 'blank-name') return t('error.blankName')
  if (error.code === 'invalid-size') return t('error.invalidSize')
  if (error.code === 'size-too-large') return t('error.sizeTooLarge')
  return t('error.stale')
}
export function useCommandAction() {
  const [error, setError] = useState<string | null>(null)
  const run = (action: () => void) => {
    try {
      action()
      setError(null)
      return true
    } catch (error) {
      setError(commandMessage(error))
      return false
    }
  }
  return { error, run }
}
