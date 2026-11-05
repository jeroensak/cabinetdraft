import { useState } from 'react'
import { CommandError } from '../domain/commands'
import type { DrawerIssue } from '../domain/drawers/deriveDrawerGeometry'
import { t } from '../i18n'
import { drawerIssueMessage } from '../i18n/drawerIssues'

export function commandMessage(error: unknown) {
  if (!(error instanceof CommandError)) throw error
  if (error.code === 'structural-conflict') return t('error.structuralConflict')
  if (error.code === 'invalid-integer') return t('field.wholeMm')
  if (error.code === 'slot-too-narrow') return t('error.slotTooNarrow')
  if (error.code === 'divider-in-use') return t('error.dividerInUse')
  if (error.code === 'shelf-has-dividers') return t('error.shelfHasDividers')
  if (
    error.code === 'invalid-drawer-design' ||
    error.code === 'drawer-does-not-fit'
  ) {
    const issue = (error.data.issues as DrawerIssue[] | undefined)?.[0]
    return issue ? drawerIssueMessage(issue) : t('error.drawerNoFit')
  }
  if (error.code === 'drawer-design-in-use') return t('error.designInUse')
  if (error.code === 'space-occupied') return t('error.spaceOccupied')
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
