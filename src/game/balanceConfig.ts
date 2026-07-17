import type { BalanceMode, ModeBalanceConfig, NumberWeight, QualityWeights } from './balanceTypes'

const UNIFORM_WEIGHTS = Array.from({ length: 9 }, (_, index) => ({ value: index + 1, weight: 1 }))
const ACCESSIBLE_WEIGHTS = [
  { value: 1, weight: 1.05 }, { value: 2, weight: 1.04 }, { value: 3, weight: 1.02 },
  { value: 4, weight: 1 }, { value: 5, weight: 0.98 }, { value: 6, weight: 1 },
  { value: 7, weight: 1.02 }, { value: 8, weight: 1.04 }, { value: 9, weight: 1.05 },
] as const satisfies readonly NumberWeight[]
const HARD_WEIGHTS = [
  { value: 1, weight: 0.92 }, { value: 2, weight: 0.96 }, { value: 3, weight: 1.04 },
  { value: 4, weight: 1.08 }, { value: 5, weight: 1.08 }, { value: 6, weight: 1.08 },
  { value: 7, weight: 1.04 }, { value: 8, weight: 0.96 }, { value: 9, weight: 0.92 },
] as const satisfies readonly NumberWeight[]

export const qualityWeights = {
  solvability: 0.2,
  diversity: 0.15,
  spatialDistribution: 0.15,
  overlap: 0.12,
  earlyAccessibility: 0.14,
  midGameSustainability: 0.16,
  scorePotential: 0.08,
} as const satisfies QualityWeights

/**
 * One source of truth for balance-sensitive values. The generator rejects
 * outliers rather than silently changing the basic “sum to ten” rule.
 */
export const balanceConfig = {
  targetSum: 10,
  rows: 10,
  columns: 17,
  generation: {
    maxAttempts: 24,
    fallbackAttempts: 200,
    maximumLuckIndex: 32,
  },
  hint: {
    durationMs: 1_600,
    preferredMinimumArea: 2,
    preferredMaximumArea: 4,
  },
  combo: {
    windowMs: 4_000,
  },
  scoring: {
    pointsPerFruit: 1,
  },
  difficulty: {
    easyMinimumAccessibility: 72,
    hardMaximumAccessibility: 60,
  },
  qualityWeights,
  modes: {
    classic: {
      difficulty: 'Normal', roundSeconds: 120, numberWeights: UNIFORM_WEIGHTS,
      minimumQualityScore: 66, minimumValidMoves: 48, maximumValidMoves: 60,
      minimumOccupiedRegions: 8, minimumSimpleMoveRatio: 0.55,
      maximumSimpleMoveRatio: 0.68, minimumAverageArea: 2.3, maximumAverageArea: 2.7,
      maximumCellParticipationRatio: 0.085, minimumCoverageRatio: 0.52,
      hintLimit: 3,
    },
    quick: {
      difficulty: 'Easy', roundSeconds: 60, numberWeights: ACCESSIBLE_WEIGHTS,
      minimumQualityScore: 68, minimumValidMoves: 58, maximumValidMoves: 80,
      minimumOccupiedRegions: 8, minimumSimpleMoveRatio: 0.67,
      maximumSimpleMoveRatio: 0.82, minimumAverageArea: 2.1, maximumAverageArea: 2.55,
      maximumCellParticipationRatio: 0.08, minimumCoverageRatio: 0.6,
      hintLimit: 2,
    },
    zen: {
      difficulty: 'Normal', roundSeconds: null, numberWeights: ACCESSIBLE_WEIGHTS,
      minimumQualityScore: 64, minimumValidMoves: 45, maximumValidMoves: 64,
      minimumOccupiedRegions: 7, minimumSimpleMoveRatio: 0.55,
      maximumSimpleMoveRatio: 0.69, minimumAverageArea: 2.25, maximumAverageArea: 2.75,
      maximumCellParticipationRatio: 0.1, minimumCoverageRatio: 0.5,
      hintLimit: 6,
    },
    hard: {
      difficulty: 'Hard', roundSeconds: 90, numberWeights: HARD_WEIGHTS,
      minimumQualityScore: 58, minimumValidMoves: 34, maximumValidMoves: 50,
      minimumOccupiedRegions: 7, minimumSimpleMoveRatio: 0.4,
      maximumSimpleMoveRatio: 0.62, minimumAverageArea: 2.45, maximumAverageArea: 3.2,
      maximumCellParticipationRatio: 0.12, minimumCoverageRatio: 0.42,
      hintLimit: 1,
    },
  } satisfies Record<BalanceMode, ModeBalanceConfig>,
} as const

export function getModeConfig(mode: BalanceMode): ModeBalanceConfig {
  return balanceConfig.modes[mode]
}
