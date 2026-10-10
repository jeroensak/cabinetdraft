import { vi } from 'vitest'

export function mockResizeObserver() {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      private callback: ResizeObserverCallback
      constructor(callback: ResizeObserverCallback) {
        this.callback = callback
      }
      observe(target: Element) {
        this.callback(
          [
            {
              target,
              contentRect: { width: 800, height: 600 },
            } as ResizeObserverEntry,
          ],
          this as unknown as ResizeObserver,
        )
      }
      unobserve() {}
      disconnect() {}
    },
  )
}
