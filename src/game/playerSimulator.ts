import { getModeConfig } from './balanceConfig'
import { analyzeBoard } from './boardAnalyzer'
import { generateBalancedBoard } from './boardGenerator'
import { clearValidMove } from './boardSimulator'
import type { BalanceMode, ValidMove } from './balanceTypes'
import { reshuffleRemaining } from './validMoveFinder'
import { calculateMoveScore } from './scoring'
import type { RandomSource } from './random'
import type { CellValue } from './types'

export const PLAYER_MODELS = ['novice', 'regular', 'expert'] as const
export type PlayerModel = (typeof PLAYER_MODELS)[number]

export type SimulatedRound = {
  model: PlayerModel
  score: number
  clearedFruitCount: number
  invalidMoves: number
  hintsUsed: number
  systemReshuffles: number
  bestCombo: number
  comboContribution: number
  successfulMoves: number
  firstSuccessSeconds: number | null
  lastThirtySecondsScore: number
  secondsPlayed: number
  moveHistory: { fruitCount: number; area: number; combo: number }[]
}

const MODEL_CONFIG = {
  novice: { secondsPerAttempt: 5.6, invalidRate: 0.18, hintRate: 0.1 },
  regular: { secondsPerAttempt: 3.2, invalidRate: 0.08, hintRate: 0.045 },
  expert: { secondsPerAttempt: 1.85, invalidRate: 0.025, hintRate: 0.01 },
} as const

export function simulatePlayerRound(
  model: PlayerModel,
  random: RandomSource,
  mode: BalanceMode = 'classic',
  options: {
    initialBoard?: CellValue[][]
    reshuffle?: (board: CellValue[][], random: RandomSource) => CellValue[][]
    legacyScoring?: boolean
  } = {},
): SimulatedRound {
  const modelConfig = MODEL_CONFIG[model]
  const modeConfig = getModeConfig(mode)
  let board = options.initialBoard?.map((row) => [...row]) ?? generateBalancedBoard({ random, mode }).board
  const roundSeconds = modeConfig.roundSeconds ?? 180
  let secondsRemaining = roundSeconds
  let score = 0
  let clearedFruitCount = 0
  let invalidMoves = 0
  let hintsUsed = 0
  let systemReshuffles = 0
  let combo = 0
  let bestCombo = 0
  let comboContribution = 0
  let firstSuccessSeconds: number | null = null
  let lastThirtySecondsScore = 0
  const moveHistory: SimulatedRound['moveHistory'] = []
  let consecutiveReshuffles = 0

  while (secondsRemaining > 0 && board.flat().some((value) => value !== null)) {
    const analysis = analyzeBoard(board)
    if (analysis.validMoves.length === 0) {
      board = (options.reshuffle ?? reshuffleRemaining)(board, random)
      systemReshuffles += 1
      combo = 0
      consecutiveReshuffles += 1
      if (consecutiveReshuffles > 2 || analyzeBoard(board).validMoves.length === 0) break
      continue
    }
    consecutiveReshuffles = 0
    const attemptSeconds = modelConfig.secondsPerAttempt * (0.8 + random() * 0.4)
    secondsRemaining -= attemptSeconds
    if (random() < modelConfig.invalidRate) {
      invalidMoves += 1
      combo = 0
      continue
    }
    if (hintsUsed < modeConfig.hintLimit && random() < modelConfig.hintRate) hintsUsed += 1
    combo = attemptSeconds <= 4 ? combo + 1 : 1
    bestCombo = Math.max(bestCombo, combo)
    const move = chooseMove(model, analysis.validMoves, analysis.cellParticipation, random)
    const moveScore = options.legacyScoring
      ? { total: move.fruitCount, comboBonus: 0 }
      : calculateMoveScore({ fruitCount: move.fruitCount, rectangleArea: move.area, combo, mode })
    score += moveScore.total
    if (secondsRemaining <= 30) lastThirtySecondsScore += moveScore.total
    clearedFruitCount += move.fruitCount
    comboContribution += moveScore.comboBonus
    firstSuccessSeconds ??= roundSeconds - Math.max(0, secondsRemaining)
    moveHistory.push({ fruitCount: move.fruitCount, area: move.area, combo })
    board = clearValidMove(board, move)
  }
  return {
    model, score, clearedFruitCount, invalidMoves, hintsUsed, systemReshuffles, bestCombo, comboContribution,
    successfulMoves: moveHistory.length,
    firstSuccessSeconds,
    lastThirtySecondsScore,
    secondsPlayed: roundSeconds - Math.max(0, secondsRemaining),
    moveHistory,
  }
}

export function summarizePlayerRounds(rounds: readonly SimulatedRound[]) {
  const attempts = rounds.reduce((sum, round) => sum + round.successfulMoves + round.invalidMoves, 0)
  const totalScore = rounds.reduce((sum, round) => sum + round.score, 0)
  return {
    rounds: rounds.length,
    meanScore: mean(rounds.map((round) => round.score)),
    scoreStandardDeviation: standardDeviation(rounds.map((round) => round.score)),
    meanClearedFruit: mean(rounds.map((round) => round.clearedFruitCount)),
    meanFirstSuccessSeconds: mean(rounds.map((round) => round.firstSuccessSeconds ?? round.secondsPlayed)),
    meanSecondsPerSuccess: mean(rounds.map((round) => round.successfulMoves === 0 ? round.secondsPlayed : round.secondsPlayed / round.successfulMoves)),
    invalidOperationRate: attempts === 0 ? 0 : rounds.reduce((sum, round) => sum + round.invalidMoves, 0) / attempts,
    hintUseRate: rounds.length === 0 ? 0 : rounds.filter((round) => round.hintsUsed > 0).length / rounds.length,
    lastThirtySecondsScoreRatio: totalScore === 0 ? 0 : rounds.reduce((sum, round) => sum + round.lastThirtySecondsScore, 0) / totalScore,
    meanHintsUsed: mean(rounds.map((round) => round.hintsUsed)),
    meanSystemReshuffles: mean(rounds.map((round) => round.systemReshuffles)),
    meanBestCombo: mean(rounds.map((round) => round.bestCombo)),
    meanComboContribution: mean(rounds.map((round) => round.comboContribution)),
  }
}

function chooseMove(model: PlayerModel, moves: readonly ValidMove[], participation: readonly number[][], random: RandomSource): ValidMove {
  const ranked = [...moves].sort((first, second) => {
    if (model === 'novice') return first.area - second.area || first.fruitCount - second.fruitCount
    if (model === 'regular') return Math.abs(first.area - 3) - Math.abs(second.area - 3) || second.fruitCount - first.fruitCount
    const firstOverlap = first.cells.reduce((sum, cell) => sum + (participation[cell.row]?.[cell.column] ?? 0), 0)
    const secondOverlap = second.cells.reduce((sum, cell) => sum + (participation[cell.row]?.[cell.column] ?? 0), 0)
    return second.fruitCount - first.fruitCount || firstOverlap - secondOverlap || first.area - second.area
  })
  const choiceCount = model === 'expert' ? 3 : model === 'regular' ? 7 : 10
  return ranked[Math.floor(random() * Math.min(choiceCount, ranked.length))] ?? ranked[0]!
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length
}

function standardDeviation(values: readonly number[]): number {
  const average = mean(values)
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)))
}
