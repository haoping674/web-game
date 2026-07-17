import { getModeConfig, balanceConfig } from './balanceConfig'
import { analyzeBoard } from './boardAnalyzer'
import { calculateBoardQuality, isBoardQualityAccepted, isBoardStructureAccepted } from './boardQuality'
import type { BalanceMode, GeneratedBoard, NumberWeight } from './balanceTypes'
import type { RandomSource } from './random'
import { randomInteger } from './random'
import type { CellValue } from './types'

export type { RandomSource } from './random'

export function generateBoard(random: RandomSource = Math.random, mode: BalanceMode = 'classic'): CellValue[][] {
  return generateBalancedBoard({ random, mode }).board
}

export function generateBalancedBoard({
  random = Math.random,
  mode = 'classic',
  seed,
}: {
  random?: RandomSource
  mode?: BalanceMode
  seed?: number
} = {}): GeneratedBoard {
  let best: GeneratedBoard | null = null
  for (let attempt = 1; attempt <= balanceConfig.generation.maxAttempts; attempt += 1) {
    const board = createWeightedBoard(random, getModeConfig(mode).numberWeights)
    const analysis = analyzeBoard(board)
    if (!isBoardStructureAccepted(analysis, mode)) continue
    const candidate = describeBoard(board, mode, attempt, false, seed, analysis)
    if (best === null || candidate.metadata.quality.score > best.metadata.quality.score) best = candidate
    if (isBoardQualityAccepted(candidate.metadata.analysis, candidate.metadata.quality, mode)) return candidate
  }

  for (let fallbackAttempt = 1; fallbackAttempt <= balanceConfig.generation.fallbackAttempts; fallbackAttempt += 1) {
    const board = createFallbackBoard(random, getModeConfig(mode).numberWeights, mode)
    const attempts = balanceConfig.generation.maxAttempts + fallbackAttempt
    const analysis = analyzeBoard(board)
    const structurallyAccepted = isBoardStructureAccepted(analysis, mode)
    if (!structurallyAccepted && (fallbackAttempt < balanceConfig.generation.fallbackAttempts || best !== null)) continue
    const candidate = describeBoard(board, mode, attempts, true, seed, analysis)
    if (best === null || candidate.metadata.quality.score > best.metadata.quality.score) best = candidate
    if (isBoardQualityAccepted(candidate.metadata.analysis, candidate.metadata.quality, mode)) return candidate
  }
  if (best === null) throw new Error('Board generator produced no candidates')
  return { ...best, metadata: { ...best.metadata, usedFallback: true } }
}

function createWeightedBoard(random: RandomSource, weights: readonly NumberWeight[]): CellValue[][] {
  return Array.from({ length: balanceConfig.rows }, () =>
    Array.from({ length: balanceConfig.columns }, () => weightedDigit(random, weights)),
  )
}

function createFallbackBoard(random: RandomSource, weights: readonly NumberWeight[], mode: BalanceMode): CellValue[][] {
  const board = createWeightedBoard(random, weights)
  const rowBands = [[0, 2], [3, 6], [7, 9]] as const
  rowBands.forEach(([minimumRow, maximumRow]) => {
    const row = randomInteger(random, minimumRow, maximumRow)
    const column = randomInteger(random, 0, balanceConfig.columns - 4)
    if (mode === 'hard') {
      const pattern = shufflePattern([1, 2, 3, 4], random)
      pattern.forEach((value, offset) => { board[row]![column + offset] = value })
    } else {
      const complement = randomInteger(random, 1, 9)
      board[row]![column] = complement
      board[row]![column + 1] = balanceConfig.targetSum - complement
      const verticalStart = Math.min(balanceConfig.rows - 2, row)
      const verticalColumn = column + 3
      const verticalComplement = randomInteger(random, 1, 9)
      board[verticalStart]![verticalColumn] = verticalComplement
      board[verticalStart + 1]![verticalColumn] = balanceConfig.targetSum - verticalComplement
    }
  })
  return board
}

function describeBoard(board: CellValue[][], mode: BalanceMode, attempts: number, usedFallback: boolean, seed?: number, suppliedAnalysis?: ReturnType<typeof analyzeBoard>): GeneratedBoard {
  const analysis = suppliedAnalysis ?? analyzeBoard(board)
  const quality = calculateBoardQuality(board, mode, analysis)
  return {
    board,
    metadata: {
      mode,
      ...(seed === undefined ? {} : { seed }),
      attempts,
      usedFallback,
      analysis,
      quality,
    },
  }
}

function shufflePattern(pattern: readonly number[], random: RandomSource): number[] {
  const next = [...pattern]
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    ;[next[index], next[swap]] = [next[swap]!, next[index]!]
  }
  return next
}

function weightedDigit(random: RandomSource, weights: readonly NumberWeight[]): number {
  const totalWeight = weights.reduce((sum, item) => sum + item.weight, 0)
  let cursor = random() * totalWeight
  for (const item of weights) {
    cursor -= item.weight
    if (cursor <= 0) return item.value
  }
  return weights.at(-1)?.value ?? 1
}
