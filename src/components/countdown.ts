export type CountdownPhase = 'idle' | 'warning' | 'critical'

/** Presentation only: the game's existing clock remains authoritative. */
export function getCountdownPhase(seconds: number, active = true): CountdownPhase {
  if (!active || !Number.isFinite(seconds) || seconds <= 0 || seconds > 10) return 'idle'
  return seconds <= 5 ? 'critical' : 'warning'
}
