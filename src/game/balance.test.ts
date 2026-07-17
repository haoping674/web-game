import { describe, expect, it } from 'vitest'
import { getModeConfig } from './balanceConfig'
import { analyzeBoard, findAllValidMoves } from './boardAnalyzer'
import { classifyBoardDifficulty } from './boardDifficulty'
import { generateBalancedBoard } from './boardGenerator'
import { calculateBoardQuality, isBoardStructureAccepted } from './boardQuality'
import { createBalanceReport } from './balanceReport'
import { calculateComboMultiplier, calculateMoveScore } from './scoring'
import { createSeededRandom } from './random'
import { findValidMove, reshuffleRemaining, selectHintMove } from './validMoveFinder'
import { gameReducer } from './gameReducer'
import type { CellValue, GameState } from './types'

const distributedBoard: CellValue[][] = [
  [1, 9, null, null, 1, 9],
  [null, null, null, null, null, null],
  [null, null, null, null, null, null],
  [null, null, null, null, null, null],
  [null, null, null, null, null, null],
  [1, 9, null, null, 1, 9],
]
const concentratedBoard: CellValue[][] = [
  [1, 9, 1, 9, 1, 9],
  [null, null, null, null, null, null],
  [null, null, null, null, null, null],
  [null, null, null, null, null, null],
  [null, null, null, null, null, null],
  [null, null, null, null, null, null],
]

function playingState(board: CellValue[][]): GameState {
  return { board, score: 0, clearedFruitCount: 0, secondsLeft: 120, nextTickAt: 1_000, status: 'playing', combo: 0, bestCombo: 0, comboDeadline: null, successfulMoves: 0, invalidMoves: 0, hintsUsed: 0, systemReshuffles: 0 }
}

describe('board analysis and quality', () => {
  it('finds every unique valid rectangle without duplicates', () => {
    const moves = findAllValidMoves([[1, 9, 1, 9]])
    expect(moves).toHaveLength(new Set(moves.map((move) => JSON.stringify(move.rect))).size)
    expect(moves.length).toBeGreaterThan(1)
  })

  it('never includes a cleared cell in a valid rectangle', () => {
    const moves = findAllValidMoves([[1, null, 9, 1, 9]])
    expect(moves.every((move) => move.cells.every(({ row, column }) => row !== 0 || column !== 1))).toBe(true)
  })

  it('returns no move for an unsolvable board', () => expect(findValidMove([[4, 4]])).toBeNull())

  it('allows cleared cells inside a move but rejects rectangles outside the board', () => {
    expect(findValidMove([[3, null, 7]])).toEqual({ start: { row: 0, column: 0 }, end: { row: 0, column: 2 } })
    expect(gameReducer(playingState([[3, null, 7]]), { type: 'select', rect: { start: { row: 0, column: 0 }, end: { row: 0, column: 3 } }, now: 0 }).score).toBe(0)
  })

  it('calculates a stable deterministic quality score', () => {
    const first = calculateBoardQuality(distributedBoard)
    expect(calculateBoardQuality(distributedBoard)).toEqual(first)
    expect(first.score).toBeGreaterThanOrEqual(0)
    expect(first.score).toBeLessThanOrEqual(100)
  })

  it('scores spatially distributed moves above concentrated moves', () => {
    const distributed = analyzeBoard(distributedBoard)
    const concentrated = analyzeBoard(concentratedBoard)
    expect(distributed.spatialDistributionScore).toBeGreaterThan(concentrated.spatialDistributionScore)
  })

  it('penalizes excessive move overlap', () => {
    const overlapping = analyzeBoard(concentratedBoard)
    const isolated = analyzeBoard(distributedBoard)
    expect(overlapping.maxCellParticipationRatio).toBeGreaterThan(isolated.maxCellParticipationRatio)
    expect(overlapping.overlapScore).toBeLessThan(isolated.overlapScore)
  })

  it('classifies structural Easy, Normal, and Hard examples by configured thresholds', () => {
    const base = analyzeBoard(distributedBoard)
    expect(classifyBoardDifficulty({ ...base, validMoveCount: 75, simpleMoveRatio: 0.8, averageArea: 2.1 })).toBe('Easy')
    expect(classifyBoardDifficulty({ ...base, validMoveCount: 55, simpleMoveRatio: 0.62, averageArea: 2.5 })).toBe('Normal')
    expect(classifyBoardDifficulty({ ...base, validMoveCount: 35, simpleMoveRatio: 0.4, averageArea: 3 })).toBe('Hard')
  })

  it('rejects a low-quality candidate before expensive generation scoring', () => {
    const poor = analyzeBoard(Array.from({ length: 10 }, () => Array.from({ length: 17 }, () => 5)))
    expect(isBoardStructureAccepted(poor, 'classic')).toBe(false)
  })
})

describe('constrained generation and reshuffling', () => {
  it('always generates an opening move and metadata', () => {
    const generated = generateBalancedBoard({ random: createSeededRandom(11), seed: 11 })
    expect(findValidMove(generated.board)).not.toBeNull()
    expect(generated.metadata.analysis.validMoveCount).toBeGreaterThan(0)
  })

  it('uses the randomized fallback after exhausting invalid identical candidates', () => {
    const generated = generateBalancedBoard({ random: () => 0.5 })
    expect(generated.metadata.usedFallback).toBe(true)
    expect(findValidMove(generated.board)).not.toBeNull()
  })

  it('keeps fallback boards random instead of returning one hard-coded board', () => {
    const first = generateBalancedBoard({ random: createSeededRandom(1), mode: 'quick' })
    const second = generateBalancedBoard({ random: createSeededRandom(2), mode: 'quick' })
    expect(first.board).not.toEqual(second.board)
  })

  it('reproduces the same board from the same seed', () => {
    const first = generateBalancedBoard({ random: createSeededRandom(42), seed: 42 })
    const second = generateBalancedBoard({ random: createSeededRandom(42), seed: 42 })
    expect(second).toEqual(first)
  })

  it('returns the configured difficulty for ordinary seeded mode generation', () => {
    const cases = [['quick', 'Easy'], ['classic', 'Normal'], ['zen', 'Normal'], ['hard', 'Hard']] as const
    cases.forEach(([mode, difficulty], index) => {
      expect(generateBalancedBoard({ random: createSeededRandom(100 + index), mode }).metadata.quality.difficulty).toBe(difficulty)
    })
  })

  it('guarantees a move after reshuffling a repairable no-move board', () => {
    const reshuffled = reshuffleRemaining([[4, 4, 4, 4]], createSeededRandom(7))
    expect(findValidMove(reshuffled)).not.toBeNull()
    expect(reshuffled.flat().filter((value) => value !== null)).toHaveLength(4)
  })

  it('does not charge player resources for a system no-move reshuffle', () => {
    const next = gameReducer(playingState([[4, 4, 4, 4]]), { type: 'reshuffle' })
    expect(next).toMatchObject({ secondsLeft: 120, systemReshuffles: 1 })
    expect(findValidMove(next.board)).not.toBeNull()
  })

  it('ignores no-move reshuffle requests when fewer than two fruits remain', () => {
    const state = playingState([[4, null]])
    expect(gameReducer(state, { type: 'reshuffle' })).toBe(state)
  })

  it('cannot reshuffle a board that still has a valid move', () => {
    const state = playingState([[1, 9, 4, 4]])
    expect(gameReducer(state, { type: 'reshuffle' })).toBe(state)
  })
})

describe('hints, combo, scoring, and modes', () => {
  it('allows hints to span cleared cells while highlighting the canonical rectangle', () => {
    const board: CellValue[][] = [[1, null, 9, 1, 9]]
    const hint = selectHintMove(board, () => 0)
    expect(hint).toEqual({ start: { row: 0, column: 0 }, end: { row: 0, column: 2 } })
  })

  it('does not always select the same hint position', () => {
    const board: CellValue[][] = [[1, 9, 1, 9, 1, 9]]
    expect(selectHintMove(board, () => 0)).not.toEqual(selectHintMove(board, () => 0.99))
  })

  it('does not consume a hint when the board has no move', () => {
    const state = playingState([[4, 4]])
    expect(gameReducer(state, { type: 'use-hint' })).toBe(state)
  })

  it('shows a hint without directly changing the board or score', () => {
    const state = playingState([[1, 9]])
    const next = gameReducer(state, { type: 'use-hint' })
    expect(next.board).toBe(state.board)
    expect(next.score).toBe(0)
    expect(next.hintsUsed).toBe(1)
  })

  it('keeps Combo multiplier neutral and scoring pure', () => {
    expect(calculateComboMultiplier(10_000)).toBe(1)
    const input = { fruitCount: 6, rectangleArea: 6, combo: 10 }
    expect(calculateMoveScore(input)).toEqual(calculateMoveScore(input))
    expect(calculateMoveScore(input)).toEqual({ total: 6, base: 6, sizeBonus: 0, comboBonus: 0, comboMultiplier: 1 })
  })

  it('never adds Combo or rectangle-size points', () => {
    const score = calculateMoveScore({ fruitCount: 9, rectangleArea: 9, combo: 100 })
    expect(score).toEqual({ total: 9, base: 9, sizeBonus: 0, comboBonus: 0, comboMultiplier: 1 })
  })

  it('keeps each mode configuration independent and explicit', () => {
    expect(getModeConfig('quick').roundSeconds).toBe(60)
    expect(getModeConfig('classic').roundSeconds).toBe(120)
    expect(getModeConfig('zen').roundSeconds).toBeNull()
    expect(getModeConfig('hard').hintLimit).toBeLessThan(getModeConfig('classic').hintLimit)
  })
})

describe('quantitative regression samples', () => {
  it('has zero openings without a valid move across 1,000 seeded generations', () => {
    const random = createSeededRandom(20_260_716)
    for (let index = 0; index < 1_000; index += 1) expect(findValidMove(generateBalancedBoard({ random }).board)).not.toBeNull()
  }, 120_000)

  it('keeps extreme opening move counts at zero across 1,000 seeded generations', () => {
    const random = createSeededRandom(20_260_716)
    const counts = Array.from({ length: 1_000 }, () => generateBalancedBoard({ random }).metadata.analysis.validMoveCount)
    expect(counts.filter((count) => count < 20 || count > 100)).toHaveLength(0)
  }, 120_000)

  it('emits a deterministic aggregate report', () => {
    const random = createSeededRandom(9)
    const boards = Array.from({ length: 5 }, () => generateBalancedBoard({ random }).board)
    expect(createBalanceReport(boards, 9)).toEqual(createBalanceReport(boards, 9))
  })
})
