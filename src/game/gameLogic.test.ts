import { describe, expect, it } from 'vitest'
import { generateBoard } from './boardGenerator'
import { BOARD_COLUMNS, BOARD_ROWS, COMBO_WINDOW_MS, ROUND_SECONDS } from './constants'
import { createGameState, gameReducer } from './gameReducer'
import { getRectangleCells, sumSelection } from './selectionCalculator'
import { clearGameData, defaultStoredGameData, readGameData, recordFinishedRound, saveGameData } from './storage'
import { findValidMove, reshuffleRemaining } from './validMoveFinder'
import type { CellValue, GameState } from './types'

const board: CellValue[][] = [[1, 2, 3], [4, 5, 6], [5, 8, 9]]
const state = (overrides: Partial<GameState> = {}): GameState => ({ board, score: 0, secondsLeft: ROUND_SECONDS, status: 'playing', combo: 0, bestCombo: 0, comboDeadline: null, successfulMoves: 0, invalidMoves: 0, hintsUsed: 0, ...overrides })
const successRect = { start: { row: 0, column: 0 }, end: { row: 2, column: 0 } }
const storage = () => {
  const memory = new Map<string, string>()
  return { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value), removeItem: (key: string) => memory.delete(key), clear: () => memory.clear(), key: () => null, get length() { return memory.size } } as Storage
}

describe('selection and board logic', () => {
  it('returns all points in a normalized rectangle', () => expect(getRectangleCells({ start: { row: 1, column: 2 }, end: { row: 0, column: 1 } })).toEqual([{ row: 0, column: 1 }, { row: 0, column: 2 }, { row: 1, column: 1 }, { row: 1, column: 2 }]))
  it('sums a selected rectangle and clears only an exact 10', () => { expect(sumSelection(board, { start: { row: 0, column: 0 }, end: { row: 1, column: 1 } })).toBe(12); expect(gameReducer(state(), { type: 'select', rect: successRect, now: 0 }).board.map((row) => row[0])).toEqual([null, null, null]) })
  it('does not score a repeated or invalid selection', () => { const once = gameReducer(state(), { type: 'select', rect: successRect, now: 0 }); expect(gameReducer(once, { type: 'select', rect: successRect, now: 1 }).score).toBe(3); expect(gameReducer(state(), { type: 'select', rect: { start: { row: 0, column: 0 }, end: { row: 0, column: 1 } }, now: 0 }).score).toBe(0) })
  it('generates a complete board with a known valid move', () => { const generated = generateBoard(() => 0.5); expect(generated).toHaveLength(BOARD_ROWS); expect(generated[0]).toHaveLength(BOARD_COLUMNS); expect(findValidMove(generated)).not.toBeNull() })
})

describe('moves, combo and hints', () => {
  it('finds a 10 rectangle and never selects cleared cells', () => { const move = findValidMove([[null, 1, 9]]); expect(move).toEqual({ start: { row: 0, column: 1 }, end: { row: 0, column: 2 } }) })
  it('reports no move when none exists', () => expect(findValidMove([[4, 4]])).toBeNull())
  it('reshuffles remaining fruit into a board with a valid move', () => expect(findValidMove(reshuffleRemaining([[4, 4, 4, 4]]))).not.toBeNull())
  it('increments combo in the window and clears it on expiration or invalid input', () => { const once = gameReducer(state(), { type: 'select', rect: successRect, now: 100 }); const twice = gameReducer({ ...once, board }, { type: 'select', rect: successRect, now: 100 + COMBO_WINDOW_MS - 1 }); expect(twice.combo).toBe(2); expect(gameReducer(twice, { type: 'tick', now: twice.comboDeadline! + 1 }).combo).toBe(0); expect(gameReducer(twice, { type: 'select', rect: { start: { row: 0, column: 0 }, end: { row: 0, column: 1 } }, now: 200 }).combo).toBe(0) })
  it('does not update a finished game and freezes timer/combo while paused', () => { const paused = gameReducer(state({ combo: 2, comboDeadline: 1000 }), { type: 'pause', now: 100 }); expect(gameReducer(paused, { type: 'tick', now: 5_000 })).toBe(paused); const finished = state({ status: 'finished' }); expect(gameReducer(finished, { type: 'select', rect: successRect, now: 0 })).toBe(finished) })
  it('limits hints to the configured count', () => { let current = state(); current = gameReducer(current, { type: 'use-hint' }); current = gameReducer(current, { type: 'use-hint' }); current = gameReducer(current, { type: 'use-hint' }); expect(gameReducer(current, { type: 'use-hint' }).hintsUsed).toBe(3) })
})

describe('resilient local game data', () => {
  it('accumulates statistics and calculates a safe average source', () => { const next = recordFinishedRound(defaultStoredGameData, 12, 12, 4, 6); expect(next.statistics).toMatchObject({ highScore: 12, lastScore: 12, gamesPlayed: 1, totalCleared: 12, highestCombo: 4, totalScore: 12, bestClearsPerMinute: 6 }) })
  it('recovers from corrupt and older data', () => { const memory = storage(); memory.setItem('orchard-ten-v2', 'not-json'); expect(readGameData(memory)).toEqual(defaultStoredGameData); memory.setItem('orchard-ten-v2', JSON.stringify({ settings: { soundEnabled: false }, statistics: { highScore: 8 } })); expect(readGameData(memory).statistics.highScore).toBe(8) })
  it('persists tutorial/settings and clears safely', () => { const memory = storage(); const saved = saveGameData({ ...defaultStoredGameData, tutorialSeen: true, settings: { ...defaultStoredGameData.settings, volume: 0.2 } }, memory); expect(readGameData(memory)).toEqual(saved); expect(clearGameData(memory)).toEqual(defaultStoredGameData); expect(readGameData(memory)).toEqual(defaultStoredGameData) })
  it('creates a fresh state with configured game duration', () => expect(createGameState().secondsLeft).toBe(ROUND_SECONDS))
})
