import { useEffect, useRef, useState, type ReactNode } from 'react'

/** An icon button in the header that opens a small menu of actions. */
export function HeaderMenu({
  label,
  icon,
  children,
}: {
  label: string
  icon: ReactNode
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const items = () => [
    ...(list.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ??
      []),
  ]
  useEffect(() => {
    if (!open) return
    items()[0]?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      button.current?.focus()
    }
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [open])
  return (
    <div className="header-menu" ref={root}>
      <button
        ref={button}
        className="header-icon-button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {icon}
      </button>
      {open && (
        <div
          ref={list}
          className="header-menu-list"
          role="menu"
          aria-label={label}
          onClick={() => setOpen(false)}
          onKeyDown={(event) => {
            const step = { ArrowDown: 1, ArrowUp: -1 }[event.key]
            if (!step) return
            event.preventDefault()
            const all = items()
            const next = all.indexOf(document.activeElement as HTMLElement)
            all[(next + step + all.length) % all.length]?.focus()
          }}
        >
          {children}
        </div>
      )}
    </div>
  )
}
