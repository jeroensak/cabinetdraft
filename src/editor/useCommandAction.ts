import { useState } from 'react'
import { CommandError } from '../domain/commands'

export function commandMessage(error: unknown) {
  if (!(error instanceof CommandError)) throw error
  if (error.code === 'structural-conflict')
    return 'This change conflicts with an existing front or its boundaries. Remove the affected front before making this change.'
  if (error.code === 'invalid-integer')
    return 'Enter a whole number in millimetres.'
  if (error.code === 'slot-too-narrow')
    return 'This space is too narrow for a divider and two free openings.'
  if (error.code === 'divider-in-use')
    return 'Remove shelves and fronts attached to this divider first.'
  if (error.code === 'shelf-has-dividers')
    return 'Remove the dividers attached to this shelf before deleting it.'
  if (
    error.code === 'invalid-drawer-design' ||
    error.code === 'drawer-does-not-fit'
  ) {
    const issues = error.data.issues as { message: string }[] | undefined
    return (
      issues?.[0]?.message ??
      'This drawer design does not fit the selected space.'
    )
  }
  if (error.code === 'drawer-design-in-use')
    return 'Remove this design from its drawers before deleting it.'
  if (error.code === 'space-occupied')
    return 'A door covers one of the selected spaces. Remove the door before adding a drawer.'
  return 'This selection is no longer available. Select it again and retry.'
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
