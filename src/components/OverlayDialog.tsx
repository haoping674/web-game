import { translate } from '../app/translate'
import { useEffect, useEffectEvent, useRef } from 'react'
import type { ReactNode } from 'react'
import { isolateDialog } from './dialogBackground'

type OverlayDialogProps = { children: ReactNode; label: string; onClose?: () => void; onEscape?: () => void; labelledBy?: string }

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, summary, [contenteditable="true"], [tabindex]'

function canFocus(element: HTMLElement): boolean {
  if (element.tabIndex < 0 || element.matches(':disabled') || element.closest('[hidden], [inert], [aria-hidden="true"]')) return false
  for (let ancestor: HTMLElement | null = element; ancestor; ancestor = ancestor.parentElement) {
    const style = getComputedStyle(ancestor)
    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false
    if (ancestor instanceof HTMLDetailsElement && !ancestor.open && !ancestor.querySelector('summary')?.contains(element)) return false
  }
  return true
}

export function OverlayDialog({ children, label, onClose, onEscape, labelledBy }: OverlayDialogProps) {
  const dialogRef = useRef<HTMLElement>(null)
  const escape = useEffectEvent(() => (onEscape ?? onClose)?.())
  useEffect(() => {
    const dialog = dialogRef.current!
    const previouslyFocused = document.activeElement as HTMLElement | null
    const restoreBackground = isolateDialog(dialog.parentElement!)
    const getFocusable = () => [...(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []), ...document.querySelectorAll<HTMLElement>('.pwa-update button')]
      .filter(canFocus)
    const isTopmostDialog = () => {
      const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')
      return dialogs.length > 0 && dialogs[dialogs.length - 1] === dialogRef.current
    }
    const focusFirst = () => (getFocusable()[0] ?? dialog).focus()
    const timer = window.setTimeout(() => { if (isTopmostDialog()) focusFirst() }, 0)
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isTopmostDialog() || event.defaultPrevented || event.isComposing || event.keyCode === 229) return
      if (event.key === 'Escape') { event.preventDefault(); escape(); return }
      if (event.key !== 'Tab') return
      const focusable = getFocusable()
      if (focusable.length === 0) { event.preventDefault(); dialog.focus(); return }
      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      const activeElement = document.activeElement
      if (!dialogRef.current?.contains(activeElement) && !(activeElement instanceof Element && activeElement.closest('.pwa-update'))) { event.preventDefault(); (event.shiftKey ? last : first).focus() }
      else if (event.shiftKey && activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && activeElement === last) { event.preventDefault(); first.focus() }
    }
    const containFocus = (event: FocusEvent) => {
      if (!isTopmostDialog() || dialogRef.current?.contains(event.target as Node) || (event.target instanceof Element && event.target.closest('.pwa-update'))) return
      focusFirst()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('focusin', containFocus)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('focusin', containFocus)
      restoreBackground()
      if (previouslyFocused?.isConnected) previouslyFocused.focus()
    }
  }, [])
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose?.() }}><section ref={dialogRef} tabIndex={-1} className="dialog" role="dialog" aria-modal="true" aria-label={labelledBy ? undefined : translate(label)} aria-labelledby={labelledBy}>{onClose && <button type="button" className="dialog-close" aria-label={translate("關閉對話框")} onClick={onClose}>×</button>}{children}</section></div>
}
