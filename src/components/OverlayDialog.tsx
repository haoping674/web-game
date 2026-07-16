import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

type OverlayDialogProps = { children: ReactNode; label: string; onClose?: () => void; onEscape?: () => void; labelledBy?: string }

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export function OverlayDialog({ children, label, onClose, onEscape, labelledBy }: OverlayDialogProps) {
  const dialogRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const getFocusable = () => [...(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [])]
      .filter((element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true')
    const isTopmostDialog = () => {
      const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')
      return dialogs.length > 0 && dialogs[dialogs.length - 1] === dialogRef.current
    }
    const focusFirst = () => getFocusable()[0]?.focus()
    const timer = window.setTimeout(focusFirst, 0)
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isTopmostDialog()) return
      const escapeAction = onEscape ?? onClose
      if (event.key === 'Escape' && escapeAction) { event.preventDefault(); escapeAction(); return }
      if (event.key !== 'Tab') return
      const focusable = getFocusable()
      if (focusable.length === 0) return
      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      const activeElement = document.activeElement
      if (!dialogRef.current?.contains(activeElement)) { event.preventDefault(); (event.shiftKey ? last : first).focus() }
      else if (event.shiftKey && activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && activeElement === last) { event.preventDefault(); first.focus() }
    }
    const containFocus = (event: FocusEvent) => {
      if (!isTopmostDialog() || dialogRef.current?.contains(event.target as Node)) return
      focusFirst()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('focusin', containFocus)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('focusin', containFocus)
      if (previouslyFocused?.isConnected) previouslyFocused.focus()
    }
  }, [onClose, onEscape])
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose?.() }}><section ref={dialogRef} className="dialog" role="dialog" aria-modal="true" aria-label={label} aria-labelledby={labelledBy}>{onClose && <button type="button" className="dialog-close" aria-label="關閉對話框" onClick={onClose}>×</button>}{children}</section></div>
}
