import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

type OverlayDialogProps = { children: ReactNode; label: string; onClose?: () => void; labelledBy?: string }

export function OverlayDialog({ children, label, onClose, labelledBy }: OverlayDialogProps) {
  const dialogRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const timer = window.setTimeout(() => dialogRef.current?.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')?.focus(), 0)
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onClose) { event.preventDefault(); onClose(); return }
      if (event.key !== 'Tab') return
      const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? [])].filter((element) => !element.hasAttribute('disabled'))
      if (focusable.length === 0) return
      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => { window.clearTimeout(timer); document.removeEventListener('keydown', handleKeyDown); previouslyFocused?.focus() }
  }, [onClose])
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose?.() }}><section ref={dialogRef} className="dialog" role="dialog" aria-modal="true" aria-label={label} aria-labelledby={labelledBy}>{onClose && <button type="button" className="dialog-close" aria-label="關閉對話框" onClick={onClose}>×</button>}{children}</section></div>
}
