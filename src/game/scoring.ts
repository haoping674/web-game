import { balanceConfig } from './balanceConfig'
import { PERFORMANCE_TIERS } from './constants'
import type { BalanceMode } from './balanceTypes'

export type MoveScoreInput = {
  fruitCount: number
  rectangleArea: number
  combo: number
  mode?: BalanceMode
}

export type MoveScore = {
  total: number
  base: number
  sizeBonus: number
  comboBonus: number
  comboMultiplier: number
}

export function calculateMoveScore({ fruitCount, rectangleArea, combo, mode = 'classic' }: MoveScoreInput): MoveScore {
  const base = Math.max(0, fruitCount) * balanceConfig.scoring.pointsPerFruit
  void rectangleArea
  void combo
  void mode
  return { total: base, base, sizeBonus: 0, comboBonus: 0, comboMultiplier: 1 }
}

export function calculateComboMultiplier(_combo: number): number {
  return 1
}

export function getPerformanceLabel(score: number): string {
  return [...PERFORMANCE_TIERS].reverse().find((tier) => score >= tier.minimum)?.label ?? PERFORMANCE_TIERS[0].label
}

export function clearsPerMinute(cleared: number, secondsPlayed: number): number {
  if (secondsPlayed <= 0) return 0
  return Math.round((cleared / (secondsPlayed / 60)) * 10) / 10
}
