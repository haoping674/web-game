import { describe, expect, it } from 'vitest'
import {
  evaluateBoardQuality,
  findAllValidMoves,
  findMatchesAtCell,
  findNearestTiles,
  generateBoard,
  reshuffleRemainingTiles,
} from './board'
import type { ColorLinksBoard } from './types'
import { COLOR_IDS } from './types'
import { COLOR_LINKS_CONFIG } from './config'
import { colorLinksReducer, createColorLinksState } from './gameReducer'

const CROSS_BOARD: ColorLinksBoard = [
  [null, 'coral', null, null, null],
  [null, null, null, null, null],
  ['blue', null, null, null, 'blue'],
  [null, null, null, null, null],
  [null, 'coral', null, null, null],
]

function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0
    return state / 0x1_0000_0000
  }
}

describe('Color Links directional matching', () => {
  it('searches through intervening blanks and returns only the nearest tile in each direction', () => {
    const nearest = findNearestTiles(CROSS_BOARD, { row: 2, column: 1 })
    expect(nearest.up).toMatchObject({ row: 0, column: 1, color: 'coral', direction: 'up' })
    expect(nearest.down).toMatchObject({ row: 4, column: 1, color: 'coral', direction: 'down' })
    expect(nearest.left).toMatchObject({ row: 2, column: 0, color: 'blue', direction: 'left' })
    expect(nearest.right).toMatchObject({ row: 2, column: 4, color: 'blue', direction: 'right' })
  })

  it('rejects filled and out-of-bounds cells', () => {
    expect(findNearestTiles(CROSS_BOARD, { row: 0, column: 1 })).toEqual({})
    expect(findNearestTiles(CROSS_BOARD, { row: -1, column: 2 })).toEqual({})
  })

  it('returns every independent color group with at least two directions', () => {
    const matches = findMatchesAtCell(CROSS_BOARD, { row: 2, column: 1 })
    expect(matches).toHaveLength(2)
    expect(matches.map((match) => [match.color, match.tiles.length])).toEqual([
      ['coral', 2],
      ['blue', 2],
    ])
  })

  it('does not match directions with different colors', () => {
    const board: ColorLinksBoard = [
      [null, 'coral', null],
      ['blue', null, 'amber'],
      [null, 'teal', null],
    ]
    expect(findMatchesAtCell(board, { row: 1, column: 1 })).toEqual([])
  })

  it('finds all and only playable empty cells', () => {
    const moves = findAllValidMoves(CROSS_BOARD)
    expect(moves).toContainEqual({ row: 2, column: 1 })
    expect(moves).not.toContainEqual({ row: 0, column: 1 })
  })
})

describe('Color Links board generation and recovery', () => {
  it('generates varied, balanced openings with multiple valid moves', () => {
    for (let seed = 1; seed <= 100; seed += 1) {
      const board = generateBoard(seededRandom(seed))
      const quality = evaluateBoardQuality(board)
      expect(board).toHaveLength(10)
      expect(board.every((row) => row.length === 17)).toBe(true)
      expect(quality.validMoveCount).toBeGreaterThanOrEqual(12)
      expect(quality.filledRatio).toBeGreaterThanOrEqual(0.46)
      expect(quality.filledRatio).toBeLessThanOrEqual(0.7)
      expect(quality.maxColorRatio).toBeLessThanOrEqual(0.36)
      expect(board.flat().filter((cell) => cell !== null)).toHaveLength(100)
      for (const color of COLOR_IDS) {
        expect(board.flat().filter((cell) => cell === color)).toHaveLength(20)
      }
    }
  })

  it('reports when remaining singleton colors cannot be reshuffled into a move', () => {
    const deadBoard: ColorLinksBoard = [
      ['coral', null, 'amber'],
      [null, null, null],
      ['teal', null, 'blue'],
    ]
    expect(findAllValidMoves(deadBoard)).toEqual([])
    const recovery = reshuffleRemainingTiles(deadBoard, seededRandom(7))
    expect(recovery.stranded).toBe(true)
    expect(recovery.board).toEqual(deadBoard)
  })

  it('keeps the fixed tile count and opening moves even with a constant random source', () => {
    for (const value of [0, 0.5, 0.999999]) {
      const board = generateBoard(() => value)
      expect(board.flat().filter((cell) => cell !== null)).toHaveLength(100)
      for (const color of COLOR_IDS) {
        expect(board.flat().filter((cell) => cell === color)).toHaveLength(20)
      }
      expect(evaluateBoardQuality(board).acceptable).toBe(true)
    }
  })

  it('relocates blocked pairs while preserving every tile and color', () => {
    for (const board of [
      [['coral', 'coral', null]],
      [['blue'], ['blue'], [null]],
      [['teal', 'teal'], [null, 'amber']],
    ] satisfies ColorLinksBoard[]) {
      const original = board.map((row) => [...row])
      expect(findAllValidMoves(board)).toEqual([])
      const recovery = reshuffleRemainingTiles(board, () => 0)
      expect(recovery.stranded).toBe(false)
      expect(findAllValidMoves(recovery.board).length).toBeGreaterThan(0)
      expect(recovery.board.flat().filter(Boolean).sort()).toEqual(board.flat().filter(Boolean).sort())
      expect(board).toEqual(original)
    }
  })

  it('reaches a completely empty board through random legal play and recovery in 200 rounds', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const random = seededRandom(seed)
      let state = createColorLinksState('playing', 0, generateBoard(random))
      for (let step = 0; step < 100 && state.status === 'playing'; step += 1) {
        const moves = findAllValidMoves(state.board)
        const move = moves[Math.floor(random() * moves.length)]
        if (move) {
          state = colorLinksReducer(state, { type: 'select', position: move, now: 100 })
        } else {
          const recovery = reshuffleRemainingTiles(state.board, random)
          state = colorLinksReducer(state, recovery.stranded
            ? { type: 'resolve-stranded', now: 100 }
            : { type: 'reshuffle', board: recovery.board, now: 100 })
        }
        expect(state.removedTiles + state.board.flat().filter(Boolean).length)
          .toBe(COLOR_LINKS_CONFIG.initialTileCount)
      }
      expect(state.outcome).toBe('cleared')
      expect(state.board.flat().every((cell) => cell === null)).toBe(true)
      expect(state.removedTiles).toBe(100)
    }
  })
})
