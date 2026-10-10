import type { Arrangement } from '../../domain/cabinet/deriveArrangement'
import { deriveFrontGeometry } from '../../domain/fronts/deriveFrontGeometry'
import { useProjectStore } from '../../store/projectStore'
import { panelFaces } from './projection'
import { frontName } from '../frontName'

export function FrontTargets({ arrangement }: { arrangement: Arrangement }) {
  const settings = useProjectStore((state) => state.present.settings)
  const selection = useProjectStore((state) => state.editor.selection)
  const setSelection = useProjectStore((state) => state.setSelection)
  const setHover = useProjectStore((state) => state.setHover)
  const hover = useProjectStore((state) => state.editor.hover)
  const viewport = useProjectStore((state) => state.editor.viewport)
  return (
    <g
      transform={`translate(${viewport.pan.x} ${viewport.pan.y}) scale(${viewport.zoom})`}
    >
      {arrangement.modules.flatMap(({ module, origin }) =>
        module.fronts.map((front, index) => {
          const faces = deriveFrontGeometry(
            module,
            settings,
            front,
          ).panels.flatMap((panel) => panelFaces(panel, origin))
          const choose = () =>
            setSelection({
              type: 'front',
              moduleId: module.id,
              frontId: front.id,
            })
          return (
            <g
              key={front.id}
              className="front-hit-area"
              role="button"
              tabIndex={0}
              aria-label={`${module.name} ${frontName(front).toLowerCase()} ${index + 1}`}
              aria-pressed={
                selection?.type === 'front' && selection.frontId === front.id
              }
              data-hovered={
                hover?.type === 'front' && hover.frontId === front.id
              }
              onClick={choose}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  choose()
                }
              }}
              onPointerEnter={() =>
                setHover({
                  type: 'front',
                  moduleId: module.id,
                  frontId: front.id,
                })
              }
              onPointerLeave={() => setHover(null)}
            >
              {faces.map((face, i) => (
                <polygon
                  key={i}
                  points={face.points.map((p) => `${p.x},${p.y}`).join(' ')}
                />
              ))}
            </g>
          )
        }),
      )}
    </g>
  )
}
