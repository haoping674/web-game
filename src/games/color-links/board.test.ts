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
    for (const seed of [1, 17, 2026, 88_031]) {
      const board = generateBoard(seededRandom(seed))
      const quality = evaluateBoardQuality(board)
      expect(board).toHaveLength(8)
      expect(board.every((row) => row.length === 8)).toBe(true)
      expect(quality.validMoveCount).toBeGreaterThanOrEqual(5)
      expect(quality.filledRatio).toBeGreaterThanOrEqual(0.46)
      expect(quality.filledRatio).toBeLessThanOrEqual(0.7)
      expect(quality.maxColorRatio).toBeLessThanOrEqual(0.36)
    }
  })

  it('regenerates a safe board when remaining singleton colors cannot be reshuffled into a move', () => {
    const deadBoard: ColorLinksBoard = [
      ['coral', null, 'amber'],
      [null, null, null],
      ['teal', null, 'blue'],
    ]
    expect(findAllValidMoves(deadBoard)).toEqual([])
    const recovery = reshuffleRemainingTiles(deadBoard, seededRandom(7))
    expect(recovery.regenerated).toBe(true)
    expect(findAllValidMoves(recovery.board).length).toBeGreaterThan(0)
  })
})
