import { calculateComboMultiplier, calculateMoveScore } from './scoring'

export type ComboRule = 'none' | 'milestone' | 'linear' | 'capped' | 'visual-only'

export function simulateComboRules(moves: readonly { fruitCount: number; area: number; combo: number }[]): Record<ComboRule, number> {
  const baseScore = moves.reduce((sum, move) => sum + move.fruitCount, 0)
  const milestoneScore = moves.reduce((sum, move) => sum + move.fruitCount + ([3, 5, 10].includes(move.combo) ? 1 : 0), 0)
  const linearScore = moves.reduce((sum, move) => sum + Math.round(move.fruitCount * (1 + Math.max(0, move.combo - 1) * 0.05)), 0)
  const cappedScore = moves.reduce((sum, move) => sum + calculateMoveScore({ fruitCount: move.fruitCount, rectangleArea: move.area, combo: move.combo }).total, 0)
  return { none: baseScore, milestone: milestoneScore, linear: linearScore, capped: cappedScore, 'visual-only': baseScore }
}

export function maximumComboContributionRatio(moves: readonly { fruitCount: number; area: number; combo: number }[]): number {
  const capped = simulateComboRules(moves).capped
  const base = moves.reduce((sum, move) => sum + move.fruitCount, 0)
  return capped === 0 ? 0 : Math.max(0, capped - base) / capped
}

export function configuredComboCap(): number {
  return calculateComboMultiplier(Number.MAX_SAFE_INTEGER)
}
