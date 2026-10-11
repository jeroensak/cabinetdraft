import { useCallback, useEffect, useRef, useState } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { fitViewport, isInView, zoomAt, type Bounds } from './projection'

export function useCanvasViewport(bounds: Bounds, moduleIds: string[]) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const viewport = useProjectStore((state) => state.editor.viewport)
  const setViewport = useProjectStore((state) => state.setViewport)
  const fit = useCallback(() => {
    if (useProjectStore.getState().previewBase) return
    if (size.width && size.height)
      setViewport(fitViewport(bounds, size.width, size.height))
  }, [bounds, size, setViewport])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      })
    })
    observer.observe(svg)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!size.width || !size.height) return
    const state = useProjectStore.getState()
    const previous =
      state.editor.viewportProjectId === state.present.id
        ? state.editor.viewportModuleIds
        : undefined
    const added = moduleIds.some((id) => !previous?.includes(id))
    if (
      !previous ||
      (added &&
        !isInView(
          bounds,
          useProjectStore.getState().editor.viewport,
          size.width,
          size.height,
        ))
    )
      fit()
    else setViewport({})
  }, [moduleIds, bounds, fit, size, setViewport])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      if (useProjectStore.getState().previewBase) return
      const rect = svg.getBoundingClientRect()
      const delta =
        event.deltaY *
        (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1)
      setViewport(
        zoomAt(
          useProjectStore.getState().editor.viewport,
          { x: event.clientX - rect.left, y: event.clientY - rect.top },
          Math.exp(-Math.max(-500, Math.min(500, delta)) * 0.002),
        ),
      )
    }
    svg.addEventListener('wheel', wheel, { passive: false })
    return () => svg.removeEventListener('wheel', wheel)
  }, [setViewport])

  const zoom = (factor: number) => {
    if (useProjectStore.getState().previewBase) return
    setViewport(
      zoomAt(
        useProjectStore.getState().editor.viewport,
        { x: size.width / 2, y: size.height / 2 },
        factor,
      ),
    )
  }
  return { svgRef, viewport, setViewport, size, fit, zoom }
}
