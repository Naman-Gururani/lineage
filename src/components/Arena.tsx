import { useEffect, useRef, type ReactNode } from 'react'

const FOCUSABLE =
  'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])'

export function Arena({
  label,
  tone = 'cyan',
  onClose,
  onSkip,
  children,
}: {
  label: string
  tone?: 'cyan' | 'gold'
  onClose: () => void
  onSkip?: () => void
  children: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    returnFocus.current = document.activeElement as HTMLElement
    document.body.style.overflow = 'hidden'
    const panel = panelRef.current
    panel?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key === 'Tab' && panel) {
        const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
          (el) => el.offsetParent !== null,
        )
        if (items.length === 0) return
        const first = items[0]
        const last = items[items.length - 1]
        const active = document.activeElement as HTMLElement
        if (e.shiftKey && (active === first || active === panel)) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && active === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      returnFocus.current?.focus?.()
    }
  }, [onClose])

  return (
    <div
      className="arena-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={`arena arena-${tone}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        ref={panelRef}
      >
        <header className="arena-head">
          <span className="pixel arena-label">{label}</span>
          <div className="arena-head-actions">
            {onSkip && (
              <button type="button" className="arena-skip mono" onClick={onSkip}>
                skip &amp; unlock →
              </button>
            )}
            <button type="button" className="arena-close" onClick={onClose} aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <path
                  d="M3 3l10 10M13 3L3 13"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </header>
        <div className="arena-body">{children}</div>
      </div>
    </div>
  )
}
