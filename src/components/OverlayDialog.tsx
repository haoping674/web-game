import type { ReactNode } from 'react'
type OverlayDialogProps = { children: ReactNode; label: string }
export function OverlayDialog({ children, label }: OverlayDialogProps) {
  return <div className="dialog-backdrop" role="presentation"><section className="dialog" role="dialog" aria-modal="true" aria-label={label}>{children}</section></div>
}
