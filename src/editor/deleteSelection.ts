import { deleteModule, removeShelf, removeFront } from '../domain/commands'
import type { Project } from '../domain/project/types'
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
