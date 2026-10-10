import { useState } from 'react'
import { CommandError } from '../domain/commands'

export function commandMessage(error: unknown) {
  if (!(error instanceof CommandError)) throw error
  if (error.code === 'structural-conflict')
    return 'This change conflicts with an existing front or its boundaries. Remove the affected front before making this change.'
  if (error.code === 'invalid-integer')
    return 'Enter a whole number in millimetres.'
  return 'This selection is no longer available. Select it again and retry.'
}
export function useCommandAction() {
  const [error, setError] = useState<string | null>(null)
  const run = (action: () => void) => {
    try {
      action()
      setError(null)
    } catch (error) {
      setError(commandMessage(error))
    }
  }
  return { error, run }
}
