type FlowStateOverlayProps = { active: boolean; reduced: boolean }

/** A board-local state marker that never captures input or covers fruit. */
export function FlowStateOverlay({ active, reduced }: FlowStateOverlayProps) {
  if (!active) return null
  return <div className={`flow-state-overlay${reduced ? ' is-reduced' : ''}`} aria-live="polite">
    <span aria-hidden="true">✦</span>
    <strong>Fruit Flow</strong>
  </div>
}
