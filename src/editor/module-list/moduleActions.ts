import { addModule, duplicateModule } from '../../domain/commands'
import { useProjectStore } from '../../store/projectStore'

export function addCabinet() {
  const state = useProjectStore.getState()
  state.execute(addModule)
  const module = useProjectStore.getState().present.modules.at(-1)!
  state.setSelection({ type: 'module', moduleId: module.id })
}
export function duplicateCabinet(moduleId: string) {
  const state = useProjectStore.getState()
  const index = state.present.modules.findIndex(
    (module) => module.id === moduleId,
  )
  state.execute((project) => duplicateModule(project, moduleId))
  const module = useProjectStore.getState().present.modules[index + 1]
  state.setSelection({ type: 'module', moduleId: module.id })
}
