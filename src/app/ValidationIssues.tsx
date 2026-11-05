import type { Project } from '../domain/project/types'
import type { ValidationIssue } from '../domain/validation/validateProject'
import { useTranslation } from '../i18n'
import { validationMessages } from '../i18n/validationIssues'

/** Says what is wrong; a badge alone leaves people guessing. */
export function ValidationIssues({
  project,
  issues,
}: {
  project: Project
  issues: ValidationIssue[]
}) {
  useTranslation()
  if (!issues.length) return null
  return (
    <ul className="validation-issues">
      {validationMessages(project, issues).map((message) => (
        <li key={message}>{message}</li>
      ))}
    </ul>
  )
}
