import type { createProjectStore } from '../store/projectStore'

/** A single engagement milestone, ignoring selection, previews and history traversal. */
export function observeProjectChanges(
  store: ReturnType<typeof createProjectStore>,
  onChange: () => void,
) {
  let reported = false
  return store.subscribe((state, previous) => {
    if (
      reported ||
      state.previewBase ||
      state.past.length <= previous.past.length ||
      state.future === previous.future ||
      // Redo reuses the next future object; edits/imports create a new project.
      state.present === previous.future[0]
    )
      return
    reported = true
    onChange()
  })
}
