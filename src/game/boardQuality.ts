import { getModeConfig, qualityWeights } from './balanceConfig'
import { analyzeBoard } from './boardAnalyzer'
import { classifyBoardDifficulty } from './boardDifficulty'
import { simulateBoardProgress } from './boardSimulator'
import type { BalanceMode, BoardAnalysis, BoardQuality, BoardQualityBreakdown } from './balanceTypes'
import type { CellValue } from './types'

export function calculateBoardQuality(board: CellValue[][], mode: BalanceMode = 'classic', suppliedAnalysis?: BoardAnalysis): BoardQuality {
  const analysis = suppliedAnalysis ?? analyzeBoard(board)
  const config = getModeConfig(mode)
  const progress = simulateBoardProgress(board)
  const simpleMoves = analysis.moveSizeDistribution.one + analysis.moveSizeDistribution.two
  const moveKinds = [analysis.moveSizeDistribution.two, analysis.moveSizeDistribution.three, analysis.moveSizeDistribution.fourPlus]
    .filter((count) => count > 0).length
  const solvability = analysis.validMoveCount === 0 ? 0 : bandScore(analysis.validMoveCount, config.minimumValidMoves, config.maximumValidMoves)
  const diversity = clamp(moveKinds / 3 * 55 + Math.min(1, analysis.moveSizeDistribution.three / 8) * 25 + Math.min(1, analysis.moveSizeDistribution.fourPlus / 4) * 20)
  const earlyAccessibility = clamp(Math.min(1, simpleMoves / Math.max(1, config.minimumValidMoves * config.minimumSimpleMoveRatio)) * 65 + analysis.spatialDistributionScore * 0.35)
  const midGameSustainability = mean(progress.map((snapshot, index) => {
    const expectedMoves = [30, 20, 8, 2][index] ?? 1
    const moveScore = Math.min(1, snapshot.validMoveCount / expectedMoves) * 60
    const reachScore = snapshot.clearedRatio + 0.015 >= [0.1, 0.25, 0.5, 0.75][index]! ? 40 : 0
    return moveScore + reachScore
  }))
  const scorePotential = clamp(analysis.coverageRatio / Math.max(0.01, config.minimumCoverageRatio) * 75 + Math.min(1, analysis.coveredFruitCount / 110) * 25)
  const breakdown: BoardQualityBreakdown = {
    solvability,
    diversity,
    spatialDistribution: analysis.spatialDistributionScore,
    overlap: analysis.overlapScore,
    earlyAccessibility,
    midGameSustainability,
    scorePotential,
  }
  const score = round(Object.entries(qualityWeights).reduce((total, [key, weight]) => total + breakdown[key as keyof BoardQualityBreakdown] * weight, 0))
  const luckIndex = round(clamp(
    Math.abs(analysis.validMoveCount - midpoint(config.minimumValidMoves, config.maximumValidMoves)) / Math.max(1, config.maximumValidMoves - config.minimumValidMoves) * 35
    + Math.abs(analysis.coverageRatio - 0.6) * 45
    + Math.max(0, analysis.maxCellParticipationRatio - 0.06) * 150
    + Math.max(0, 65 - midGameSustainability) * 0.25,
  ))
  return { score, breakdown: mapValues(breakdown, round), luckIndex, difficulty: classifyBoardDifficulty(analysis) }
}

export function isBoardQualityAccepted(analysis: BoardAnalysis, quality: BoardQuality, mode: BalanceMode): boolean {
  return isBoardStructureAccepted(analysis, mode)
    && quality.score >= getModeConfig(mode).minimumQualityScore
    && quality.luckIndex <= 32
}

export function isBoardStructureAccepted(analysis: BoardAnalysis, mode: BalanceMode): boolean {
  const config = getModeConfig(mode)
  return analysis.validMoveCount >= config.minimumValidMoves
    && analysis.validMoveCount <= config.maximumValidMoves
    && analysis.occupiedRegionCount >= config.minimumOccupiedRegions
    && analysis.simpleMoveRatio >= config.minimumSimpleMoveRatio
    && analysis.simpleMoveRatio <= config.maximumSimpleMoveRatio
    && analysis.averageArea >= config.minimumAverageArea
    && analysis.averageArea <= config.maximumAverageArea
    && analysis.maxCellParticipationRatio <= config.maximumCellParticipationRatio
    && analysis.coverageRatio >= config.minimumCoverageRatio
    && classifyBoardDifficulty(analysis) === config.difficulty
}

function bandScore(value: number, minimum: number, maximum: number): number {
  if (value >= minimum && value <= maximum) return 100
  if (value < minimum) return clamp(value / Math.max(1, minimum) * 100)
  return clamp(100 - (value - maximum) / Math.max(1, maximum) * 100)
}

function mapValues<T extends Record<string, number>>(values: T, project: (value: number) => number): T {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, project(value)])) as T
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length
}

function midpoint(minimum: number, maximum: number): number {
  return minimum + (maximum - minimum) / 2
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value))
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}
