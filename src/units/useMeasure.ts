import { useProjectStore } from '../store/projectStore'
import { formatMeasure, formatSize } from './index'

/** The open design's unit, and sizes written in it. */
export function useMeasure() {
  const unit = useProjectStore((state) => state.present.settings.unit ?? 'mm')
  return {
    unit,
    measure: (value: number, grouped?: boolean) =>
      formatMeasure(value, unit, grouped),
    size: (...values: number[]) => formatSize(values, unit),
  }
}
