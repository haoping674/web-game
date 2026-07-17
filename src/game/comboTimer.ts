import type { GameState } from './types'

export function getComboRemainingMs(game: Pick<GameState, 'comboDeadline' | 'status'>, now: number): number {
  if (game.comboDeadline === null) return 0
  return Math.max(0, game.status === 'paused' ? game.comboDeadline : game.comboDeadline - now)
}

export function getNextGameWakeDelay(
  nextTickAt: number | null,
  comboDeadline: number | null,
  now: number,
): number | null {
  const candidates = [nextTickAt, comboDeadline === null ? null : comboDeadline + 1]
    .filter((value): value is number => value !== null)
  if (candidates.length === 0) return null
  return Math.max(0, Math.min(...candidates) - now)
}
