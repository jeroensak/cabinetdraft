/** Canvas shortcuts must not reach the design behind an open dialog. */
export const hasOpenModal = () =>
  typeof document !== 'undefined' &&
  document.querySelector('[aria-modal="true"]') !== null
