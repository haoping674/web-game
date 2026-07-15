import { HIGH_SCORE_KEY } from './constants'

export function readHighScore(storage: Storage | undefined = globalThis.localStorage): number {
  try {
    const value = storage?.getItem(HIGH_SCORE_KEY)
    const score = Number(value)
    return Number.isFinite(score) && score > 0 ? score : 0
  } catch { return 0 }
}

export function saveHighScore(score: number, storage: Storage | undefined = globalThis.localStorage): number {
  const nextScore = Math.max(readHighScore(storage), score)
  try { storage?.setItem(HIGH_SCORE_KEY, String(nextScore)) } catch { /* Storage can be unavailable in private contexts. */ }
  return nextScore
}
