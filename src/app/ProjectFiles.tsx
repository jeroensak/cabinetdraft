import { useRef, useState } from 'react'
import {
  exportProject,
  parseProject,
  projectFilename,
  ProjectImportError,
} from '../domain/import-export/projectJson'
import { useTranslation } from '../i18n'
import { useProjectStore } from '../store/projectStore'
import { trackEvent } from './analytics'
import { HeaderMenu } from './HeaderMenu'
import { shareHash } from './shareLink'

export function ProjectFiles({ firstVisit = false }: { firstVisit?: boolean }) {
  const { t } = useTranslation()

  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [copied, setCopied] = useState(false)
  const importFile = async (file: File) => {
    setReading(true)
    setError(null)
    try {
      const raw = await file.text()
      parseProject(raw)
      // With no design yet there is nothing to replace, so nothing to confirm.
      if (firstVisit || window.confirm(t('files.confirmImport'))) {
        useProjectStore.getState().replaceProject(raw)
        trackEvent('project_imported')
      }
    } catch (error) {
      trackEvent('project_import_failed')
      setError(
        error instanceof ProjectImportError
          ? {
              'malformed-json': t('files.errorJson'),
              'unsupported-version': t('files.errorVersion'),
              'invalid-structure': t('files.errorStructure'),
            }[error.code]
          : t('files.errorRead'),
      )
    } finally {
      setReading(false)
    }
  }
  const share = async () => {
    setError(null)
    try {
      const state = useProjectStore.getState()
      const hash = await shareHash(state.previewBase ?? state.present)
      await navigator.clipboard.writeText(
        new URL(`/designer${hash}`, window.location.origin).href,
      )
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError(t('files.shareFailed'))
    }
  }
  const download = () => {
    const state = useProjectStore.getState()
    const project = state.previewBase ?? state.present
    const url = URL.createObjectURL(
      new Blob([exportProject(project)], { type: 'application/json' }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = projectFilename(project.name)
    link.click()
    trackEvent('project_exported')
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return (
    <>
      <input
        ref={input}
        hidden
        type="file"
        accept=".json,application/json"
        aria-label={t('files.importLabel')}
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void importFile(file)
        }}
      />
      {(reading || copied) && (
        <span className="file-status" role="status">
          {reading ? t('files.reading') : t('files.linkCopied')}
        </span>
      )}
      <HeaderMenu
        label={t('files.menu')}
        icon={
          <svg className="header-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" />
          </svg>
        }
      >
        <button
          className="header-menu-item"
          role="menuitem"
          disabled={reading}
          onClick={() => input.current?.click()}
        >
          {t('files.import')}
        </button>
        {!firstVisit && (
          <>
            <button
              className="header-menu-item"
              role="menuitem"
              onClick={download}
            >
              {t('files.export')}
            </button>
            <button
              className="header-menu-item"
              role="menuitem"
              onClick={() => void share()}
            >
              {t('files.share')}
            </button>
          </>
        )}
      </HeaderMenu>
      {error && (
        <div className="file-error" role="alert">
          {error}
          <button className="pill" onClick={() => setError(null)}>
            {t('files.dismiss')}
          </button>
        </div>
      )}
    </>
  )
}
