// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { ProjectFiles } from './ProjectFiles'
import { useProjectStore } from '../store/projectStore'
import { createDefaultProject } from '../domain/project/createDefaultProject'
import { exportProject } from '../domain/import-export/projectJson'
import { trackEvent } from './analytics'

vi.mock('./analytics', () => ({ trackEvent: vi.fn() }))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})
it('validates before confirmation and changes nothing when replacement is cancelled', async () => {
  const original = createDefaultProject()
  const imported = createDefaultProject()
  imported.name = 'Replacement'
  useProjectStore.setState({
    present: original,
    past: [],
    future: [],
    previewBase: null,
  })
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  const user = userEvent.setup()
  render(<ProjectFiles />)
  const file = new File([''], 'project.json', { type: 'application/json' })
  Object.defineProperty(file, 'text', {
    value: vi.fn().mockResolvedValue(exportProject(imported)),
  })
  await user.upload(screen.getByLabelText('Import project file'), file)
  await waitFor(() =>
    expect(confirm).toHaveBeenCalledWith(
      'Replace current design with imported project?',
    ),
  )
  expect(useProjectStore.getState().present).toBe(original)
  expect(useProjectStore.getState().past).toHaveLength(0)
  expect(trackEvent).not.toHaveBeenCalled()
  confirm.mockReturnValue(true)
  await user.upload(screen.getByLabelText('Import project file'), file)
  await waitFor(() =>
    expect(useProjectStore.getState().present).toEqual(imported),
  )
  expect(useProjectStore.getState().past).toHaveLength(1)
  expect(trackEvent).toHaveBeenCalledExactlyOnceWith('project_imported')
  const malformed = new File([''], 'bad.json', { type: 'application/json' })
  Object.defineProperty(malformed, 'text', {
    value: () => Promise.resolve('{'),
  })
  confirm.mockClear()
  await user.upload(screen.getByLabelText('Import project file'), malformed)
  expect(await screen.findByRole('alert')).toHaveTextContent('not valid JSON')
  expect(confirm).not.toHaveBeenCalled()
  expect(useProjectStore.getState().present).toEqual(imported)
  expect(trackEvent).toHaveBeenLastCalledWith('project_import_failed')
  expect(trackEvent).toHaveBeenCalledTimes(2)
})
