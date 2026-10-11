import { useRef, useState } from 'react'
import {
  exportProject,
  parseProject,
  projectFilename,
  ProjectImportError,
} from '../domain/import-export/projectJson'
import { useProjectStore } from '../store/projectStore'

export function ProjectFiles() {
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const importFile = async (file: File) => {
    setReading(true)
    setError(null)
    try {
      const raw = await file.text()
      parseProject(raw)
      if (window.confirm('Replace current design with imported project?'))
        useProjectStore.getState().replaceProject(raw)
    } catch (error) {
      setError(
        error instanceof ProjectImportError
          ? {
              'malformed-json': 'This file is not valid JSON.',
              'unsupported-version':
                'This project uses an unsupported schema version.',
              'invalid-structure':
                'This file does not contain a structurally valid cabinet project.',
            }[error.code]
          : 'Could not read the project file. Please try again.',
      )
    } finally {
      setReading(false)
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
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return (
    <>
      <input
        ref={input}
        hidden
        type="file"
        accept=".json,application/json"
        aria-label="Import project file"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void importFile(file)
        }}
      />
      <button
        className="pill"
        disabled={reading}
        onClick={() => input.current?.click()}
      >
        {reading ? 'Reading…' : 'Import'}
      </button>
      <button className="pill" onClick={download}>
        Export
      </button>
      {error && (
        <div className="file-error" role="alert">
          {error}
          <button className="pill" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}
    </>
  )
}
