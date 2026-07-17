import { balanceConfig } from './balanceConfig'
import type { BoardAnalysis, BoardDifficulty } from './balanceTypes'

export function calculateAccessibility(analysis: BoardAnalysis): number {
  const moveAvailability = clamp((analysis.validMoveCount - 35) / 35 * 100)
  const simpleAccessibility = clamp((analysis.simpleMoveRatio - 0.4) / 0.35 * 100)
  const areaAccessibility = clamp((3 - analysis.averageArea) / 0.8 * 100)
  return clamp(
    moveAvailability * 0.45
    + simpleAccessibility * 0.35
    + areaAccessibility * 0.2,
  )
}

export function classifyBoardDifficulty(analysis: BoardAnalysis): BoardDifficulty {
  const accessibility = calculateAccessibility(analysis)
  if (accessibility >= balanceConfig.difficulty.easyMinimumAccessibility) return 'Easy'
  if (accessibility <= balanceConfig.difficulty.hardMaximumAccessibility) return 'Hard'
  return 'Normal'
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value))
}
