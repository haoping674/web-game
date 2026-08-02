import { describe, expect, it } from 'vitest'
import { COLOR_LINKS_CONFIG } from './config'
import {
  calculateColorLinkScore,
  colorLinksReducer,
  createColorLinksState,
} from './gameReducer'
import { findMatchesAtCell } from './board'
import type { ColorLinksBoard } from './types'

const BOARD: ColorLinksBoard = [
  [null, 'coral', null, null, null],
  [null, null, null, null, null],
  ['blue', null, null, null, 'blue'],
  [null, null, null, null, null],
  [null, 'coral', null, null, null],
]

describe('Color Links reducer', () => {
  it('scores one point per removed tile plus one bonus for a second independent group', () => {
    const matches = findMatchesAtCell(BOARD, { row: 2, column: 1 })
    expect(calculateColorLinkScore(matches)).toBe(5)
    const state = createColorLinksState('playing', 0, BOARD)
    const next = colorLinksReducer(state, { type: 'select', position: { row: 2, column: 1 }, now: 100 })
    expect(next.score).toBe(5)
    expect(next.removedTiles).toBe(4)
    expect(next.successfulMoves).toBe(1)
    expect(next.board[0]?.[1]).toBeNull()
    expect(next.board[2]?.[0]).toBeNull()
    expect(next.board[2]?.[4]).toBeNull()
    expect(next.board[4]?.[1]).toBeNull()
  })

  it('ignores filled cells completely', () => {
    const state = createColorLinksState('playing', 0, BOARD)
    expect(colorLinksReducer(state, { type: 'select', position: { row: 0, column: 1 }, now: 100 })).toBe(state)
  })

  it('adds the centralized time penalty to an invalid empty click', () => {
    const board: ColorLinksBoard = [
      ['coral', null, 'amber'],
      [null, null, null],
      ['teal', null, 'blue'],
    ]
    const state = createColorLinksState('playing', 0, board)
    const next = colorLinksReducer(state, { type: 'select', position: { row: 1, column: 1 }, now: 100 })
    expect(next.invalidMoves).toBe(1)
    expect(next.score).toBe(0)
    expect(next.elapsedSeconds).toBe(COLOR_LINKS_CONFIG.invalidPenaltySeconds)
  })

  it('preserves fractional timer progress across pause and resume', () => {
    const state = createColorLinksState('playing', 1_000, BOARD)
    const paused = colorLinksReducer(state, { type: 'pause', now: 1_250 })
    expect(paused).toMatchObject({ status: 'paused', nextTickAt: 750 })
    expect(colorLinksReducer(paused, { type: 'tick', now: 9_000 })).toBe(paused)
    const resumed = colorLinksReducer(paused, { type: 'resume', now: 10_000 })
    expect(resumed).toMatchObject({ status: 'playing', nextTickAt: 10_750 })
  })

  it('continues counting upward until the board is fully cleared', () => {
    const state = createColorLinksState('playing', 0, BOARD)
    const next = colorLinksReducer(state, { type: 'tick', now: 3_400 })
    expect(next).toMatchObject({ status: 'playing', elapsedSeconds: 3, nextTickAt: 4_000 })
  })

  it('finishes immediately after the final matching colors are removed', () => {
    const board: ColorLinksBoard = [['coral', null, 'coral']]
    const state = createColorLinksState('playing', 0, board)
    const finished = colorLinksReducer(state, { type: 'select', position: { row: 0, column: 1 }, now: 100 })
    expect(finished).toMatchObject({ status: 'finished', nextTickAt: null, removedTiles: 2 })
    expect(finished.board.flat().every((cell) => cell === null)).toBe(true)
    expect(colorLinksReducer(finished, { type: 'select', position: { row: 0, column: 1 }, now: 2_000 })).toBe(finished)
  })

  it('auto-resolves stranded colors as a completed board', () => {
    const state = createColorLinksState('playing', 0, [['coral', null, 'amber']])
    const finished = colorLinksReducer(state, { type: 'resolve-stranded' })
    expect(finished).toMatchObject({ status: 'finished', nextTickAt: null, removedTiles: 2 })
    expect(finished.board.flat().every((cell) => cell === null)).toBe(true)
  })
})
