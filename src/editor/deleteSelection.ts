import {
  deleteModule,
  removeShelf,
  removeFront,
  removeDivider,
} from '../domain/commands'
import type { Project } from '../domain/project/types'
import { t } from '../i18n'
import { useProjectStore } from '../store/projectStore'
import type { Selection } from '../store/types'

export function deleteSelection(
  project: Project,
  selection: Selection,
): Project {
  if (!selection || selection.type === 'space') return project
  if (selection.type === 'module')
    return deleteModule(project, selection.moduleId)
  if (selection.type === 'shelf')
    return removeShelf(project, selection.moduleId, selection.shelfId)
  if (selection.type === 'divider')
    return removeDivider(project, selection.moduleId, selection.dividerId)
  return removeFront(project, selection.moduleId, selection.frontId)
}

export function isTextEditing(event: KeyboardEvent) {
  return event
    .composedPath()
    .some(
      (node) =>
        node instanceof HTMLElement &&
        (/^(INPUT|TEXTAREA|SELECT)$/.test(node.tagName) ||
          node.isContentEditable ||
          node.closest('[contenteditable]:not([contenteditable="false"])')),
    )
}

/** Cabinets go without asking, so their deletion offers an Undo. */
export function deleteWithNotice(run: (action: () => void) => boolean) {
  const state = useProjectStore.getState()
  const { selection } = state.editor
  const deleted =
    selection?.type === 'module'
      ? state.present.modules.find((item) => item.id === selection.moduleId)
      : undefined
  const done = run(() =>
    state.execute((project) => deleteSelection(project, selection)),
  )
  if (done && deleted)
    state.setNotice(t('notice.cabinetDeleted', { name: deleted.name }))
  return done
}
