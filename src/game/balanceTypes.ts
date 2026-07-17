import type { CellValue, GridPoint, GridRect } from './types'

export const BALANCE_MODES = ['classic', 'quick', 'zen', 'hard'] as const
export type BalanceMode = (typeof BALANCE_MODES)[number]
export type BoardDifficulty = 'Easy' | 'Normal' | 'Hard'

export type ValidMove = {
  rect: GridRect
  cells: GridPoint[]
  fruitCount: number
  area: number
  region: number
}

export type MoveSizeDistribution = {
  one: number
  two: number
  three: number
  fourPlus: number
}

export type BoardAnalysis = {
  rows: number
  columns: number
  fruitCount: number
  validMoves: ValidMove[]
  validMoveCount: number
  uniqueValidMoveCount: number
  coveredFruitCount: number
  coverageRatio: number
  moveSizeDistribution: MoveSizeDistribution
  simpleMoveRatio: number
  regionMoveCounts: number[]
  occupiedRegionCount: number
  spatialDistributionScore: number
  cellParticipation: number[][]
  maxCellParticipationRatio: number
  overlapScore: number
  easiestMove: ValidMove | null
  largestMove: ValidMove | null
  averageArea: number
  averageFruitCount: number
  digitFrequency: Record<number, number>
  digitMoveParticipation: Record<number, number>
  scorePotential: number
}

export type BoardQualityBreakdown = {
  solvability: number
  diversity: number
  spatialDistribution: number
  overlap: number
  earlyAccessibility: number
  midGameSustainability: number
  scorePotential: number
}

export type BoardQuality = {
  score: number
  breakdown: BoardQualityBreakdown
  luckIndex: number
  difficulty: BoardDifficulty
}

export type BoardGenerationMetadata = {
  mode: BalanceMode
  seed?: number
  attempts: number
  usedFallback: boolean
  analysis: BoardAnalysis
  quality: BoardQuality
}

export type GeneratedBoard = {
  board: CellValue[][]
  metadata: BoardGenerationMetadata
}

export type NumberWeight = { value: number; weight: number }

export type QualityWeights = Readonly<BoardQualityBreakdown>

export type ModeBalanceConfig = {
  difficulty: BoardDifficulty
  roundSeconds: number | null
  numberWeights: readonly NumberWeight[]
  minimumQualityScore: number
  minimumValidMoves: number
  maximumValidMoves: number
  minimumOccupiedRegions: number
  minimumSimpleMoveRatio: number
  maximumSimpleMoveRatio: number
  minimumAverageArea: number
  maximumAverageArea: number
  maximumCellParticipationRatio: number
  minimumCoverageRatio: number
  hintLimit: number
}

export type BoardProgressSnapshot = {
  clearedRatio: number
  remainingFruit: number
  validMoveCount: number
  coverageRatio: number
  occupiedRegionCount: number
  scorePotential: number
  hasMove: boolean
}

export type BaselineAggregate = {
  sampleSize: number
  seed: number
  meanValidMoves: number
  validMovesStandardDeviation: number
  noMoveRate: number
  lowMoveRate: number
  extremeHighMoveRate: number
  meanCoverageRatio: number
  meanSpatialDistributionScore: number
  meanOverlapScore: number
  meanScorePotential: number
  scorePotentialStandardDeviation: number
  meanAverageArea: number
  meanSimpleMoveRatio: number
  meanMaxCellParticipationRatio: number
  digitFrequency: Record<number, number>
  digitMoveParticipation: Record<number, number>
  progress: Record<string, {
    reachedRate: number
    noMoveRate: number
    meanValidMoves: number
    meanCoverageRatio: number
    meanOccupiedRegions: number
    meanRemainingScorePotential: number
  }>
}
