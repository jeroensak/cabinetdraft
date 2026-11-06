import type { DrawerIssue } from '../domain/drawers/deriveDrawerGeometry'
import type { Project } from '../domain/project/types'
import type {
  ValidationCode,
  ValidationIssue,
} from '../domain/validation/validateProject'
import { formatMeasure, type MeasurementUnit } from '../units'
import { drawerIssueMessage } from './drawerIssues'
import { t } from './index'

type IssueKey =
  | 'validation.frontFraction'
  | 'validation.frontSize'
  | 'validation.structure'
  | 'validation.tooSmall'
  | 'validation.panelSize'
  | 'validation.panelPosition'
  | 'validation.measurement'
  | 'validation.fronts'
  | 'validation.bandingTooThick'

const keys: Partial<Record<ValidationCode, IssueKey>> = {
  'fractional-front-dimension': 'validation.frontFraction',
  'invalid-front-dimension': 'validation.frontSize',
  'invalid-internal-width': 'validation.tooSmall',
  'invalid-interior-height': 'validation.tooSmall',
  'invalid-carcass-depth': 'validation.tooSmall',
  'invalid-panel-dimension': 'validation.panelSize',
  'invalid-space-height': 'validation.panelSize',
  'invalid-slot-width': 'validation.panelSize',
  'shelf-outside-interior': 'validation.panelPosition',
  'divider-outside-interior': 'validation.panelPosition',
  'panel-intersection': 'validation.panelPosition',
  'panel-outside-support': 'validation.panelPosition',
  'invalid-measurement': 'validation.measurement',
  'overlapping-fronts': 'validation.fronts',
  'drawer-must-cover-one-space': 'validation.fronts',
  'edge-banding-too-thick': 'validation.bandingTooThick',
}

function issueText(issue: ValidationIssue, unit: MeasurementUnit) {
  const drawer = issue.data.issue as DrawerIssue | undefined
  if (drawer) return drawerIssueMessage(drawer, unit)
  return t(keys[issue.code] ?? 'validation.structure', {
    step: formatMeasure(1, unit),
  })
}

/** Why a project is invalid, in words, once per cabinet and problem. */
export function validationMessages(
  project: Project,
  issues: ValidationIssue[],
): string[] {
  const unit = project.settings.unit ?? 'mm'
  const messages = issues.map((issue) => {
    const message = issueText(issue, unit)
    const cabinet = project.modules.find((item) => item.id === issue.moduleId)
    return cabinet
      ? t('validation.inCabinet', { cabinet: cabinet.name, message })
      : message
  })
  return [...new Set(messages)]
}
