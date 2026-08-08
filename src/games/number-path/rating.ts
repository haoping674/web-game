import type { NumberPathDifficulty } from './types'

export const NUMBER_PATH_GRADES = ['S', 'A', 'B', 'C'] as const

export type NumberPathGrade = (typeof NUMBER_PATH_GRADES)[number]

export type NumberPathRating = {
  grade: NumberPathGrade
  label: string
  summary: string
  score: number
}

const PAR_SECONDS: Record<NumberPathDifficulty, number> = {
  easy: 64,
  normal: 104,
  hard: 152,
}

export function rateNumberPathCompletion({
  difficulty,
  elapsedSeconds,
  errors,
  hintsUsed,
}: {
  difficulty: NumberPathDifficulty
  elapsedSeconds: number
  errors: number
  hintsUsed: number
}): NumberPathRating {
  const paceScore = Math.max(0, 68 - Math.round((Math.max(0, elapsedSeconds) / PAR_SECONDS[difficulty]) * 28))
  const precisionScore = Math.max(0, 22 - Math.max(0, errors) * 6)
  const hintScore = Math.max(0, 10 - Math.max(0, hintsUsed) * 3)
  const score = Math.min(100, paceScore + precisionScore + hintScore)

  if (score >= 88) return { grade: 'S', label: '無瑕路徑', summary: '迅速、精準，而且完全靠自己。', score }
  if (score >= 70) return { grade: 'A', label: '穩健路徑', summary: '判斷很準，還能再壓縮一些時間。', score }
  if (score >= 48) return { grade: 'B', label: '成功抵達', summary: '已找出正解；下次試著少走幾次回頭路。', score }
  return { grade: 'C', label: '重拾路徑', summary: '完成就是進步；再玩一次，讓路徑更熟悉。', score }
}
