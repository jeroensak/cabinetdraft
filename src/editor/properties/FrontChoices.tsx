import {
  applyDrawerDesign,
  setDoorLeaves,
  setDoorMount,
} from '../../domain/commands'
import type {
  DoorFront,
  DrawerFront,
  FrontMount,
} from '../../domain/fronts/types'
import { spaceRange } from '../../domain/spaces/spaceRanges'
import { useTranslation } from '../../i18n'
import { useProjectStore } from '../../store/projectStore'
import { useMeasure } from '../../units/useMeasure'

type Run = (action: () => void) => boolean

/** Single or double door. */
export function DoorLeavesField({
  moduleId,
  door,
  run,
}: {
  moduleId: string
  door: DoorFront
  run: Run
}) {
  const { t } = useTranslation()
  const execute = useProjectStore((state) => state.execute)
  return (
    <label className="property-field">
      <span className="sr-only">{t('frontInfo.doorLeaves')}</span>
      <select
        aria-label={t('frontInfo.doorLeaves')}
        value={door.leaves}
        onChange={(event) => {
          const leaves = Number(event.target.value) as 1 | 2
          run(() =>
            execute((project) =>
              setDoorLeaves(project, moduleId, door.id, leaves),
            ),
          )
        }}
      >
        <option value={1}>{t('front.single')}</option>
        <option value={2}>{t('front.double')}</option>
      </select>
    </label>
  )
}

/** Overlay or inset; the choice is remembered for the next new door. */
export function DoorMountField({
  moduleId,
  door,
  run,
}: {
  moduleId: string
  door: DoorFront
  run: Run
}) {
  const { t } = useTranslation()
  const { measure } = useMeasure()
  const execute = useProjectStore((state) => state.execute)
  const setLastDoorMount = useProjectStore((state) => state.setLastDoorMount)
  const settings = useProjectStore((state) => state.present.settings)
  return (
    <>
      <label className="property-field">
        <span>{t('frontInfo.position')}</span>
        <select
          aria-label={t('frontInfo.position')}
          value={door.mount ?? 'overlay'}
          onChange={(event) => {
            const mount = event.target.value as FrontMount
            if (
              run(() =>
                execute((project) =>
                  setDoorMount(project, moduleId, door.id, mount),
                ),
              )
            )
              setLastDoorMount(mount)
          }}
        >
          <option value="overlay">{t('drawer.positionOverlay')}</option>
          <option value="inset">{t('drawer.positionInset')}</option>
        </select>
      </label>
      {door.mount === 'inset' && (
        <p className="inspector-note muted">
          {t('frontInfo.insetNote', {
            value: measure(settings.frontThickness + settings.frontGap),
          })}
        </p>
      )}
    </>
  )
}

/** Switches a drawer to another design from the library. */
export function DrawerDesignField({
  moduleId,
  drawer,
  run,
}: {
  moduleId: string
  drawer: DrawerFront
  run: Run
}) {
  const { t } = useTranslation()
  const execute = useProjectStore((state) => state.execute)
  const designs = useProjectStore((state) => state.present.drawerDesigns)
  return (
    <label className="property-field">
      <span className="sr-only">{t('frontInfo.drawerBoxDesign')}</span>
      <select
        aria-label={t('frontInfo.drawerBoxDesign')}
        value={drawer.drawerDesignId ?? ''}
        onChange={(event) => {
          const designId = event.target.value
          run(() =>
            execute((project) =>
              applyDrawerDesign(project, designId, [
                { moduleId, range: spaceRange(drawer) },
              ]),
            ),
          )
        }}
      >
        {designs.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
        {!designs.some((item) => item.id === drawer.drawerDesignId) && (
          <option value={drawer.drawerDesignId ?? ''}>
            {t('frontInfo.missingDesign')}
          </option>
        )}
      </select>
    </label>
  )
}
