import { useProjectStore } from '../../store/projectStore'

export function ProjectSettings() {
  const settings = useProjectStore((state) => state.present.settings)
  return (
    <dl className="settings-values">
      <div>
        <dt>Corpus thickness</dt>
        <dd>{settings.corpusThickness} mm</dd>
      </div>
      <div>
        <dt>Back panel</dt>
        <dd className="back-state" data-enabled={settings.backPanelEnabled}>
          {settings.backPanelEnabled ? 'On' : 'Off'}
        </dd>
      </div>
      <div>
        <dt>Back thickness</dt>
        <dd>{settings.backPanelThickness} mm</dd>
      </div>
      <div>
        <dt>Front thickness</dt>
        <dd>{settings.frontThickness} mm</dd>
      </div>
      <div>
        <dt>Front gap</dt>
        <dd>{settings.frontGap} mm</dd>
      </div>
    </dl>
  )
}
