import type { BalanceMode, ModeBalanceConfig, QualityWeights } from './balanceTypes'

const UNIFORM_WEIGHTS = Array.from({ length: 9 }, (_, index) => ({ value: index + 1, weight: 1 }))
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
  } satisfies Record<BalanceMode, ModeBalanceConfig>,
} as const

export function getModeConfig(mode: BalanceMode): ModeBalanceConfig {
  return balanceConfig.modes[mode]
}
