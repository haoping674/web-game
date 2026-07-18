import { describe, expect, it } from 'vitest'
import { generateBoard } from './boardGenerator'
import { getComboWindowMs } from './comboConfig'
import { BOARD_COLUMNS, BOARD_ROWS, ROUND_SECONDS } from './constants'
import { createGameState, gameReducer } from './gameReducer'
import { getRectangleCells, sumSelection } from './selectionCalculator'
import { clearGameData, defaultStoredGameData, readGameData, recordFinishedRound, saveGameData } from './storage'
import { findValidMove, reshuffleRemaining } from './validMoveFinder'
import type { CellValue, GameState } from './types'

const board: CellValue[][] = [[1, 2, 3], [4, 5, 6], [5, 8, 9]]
const state = (overrides: Partial<GameState> = {}): GameState => ({ mode: 'classic', board, score: 0, clearedFruitCount: 0, secondsLeft: ROUND_SECONDS, nextTickAt: 1_000, status: 'playing', combo: 0, bestCombo: 0, comboDeadline: null, successfulMoves: 0, invalidMoves: 0, hintsUsed: 0, systemReshuffles: 0, ...overrides })
const successRect = { start: { row: 0, column: 0 }, end: { row: 2, column: 0 } }
const storage = () => {
  const memory = new Map<string, string>()
  return { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value), removeItem: (key: string) => memory.delete(key), clear: () => memory.clear(), key: () => null, get length() { return memory.size } } as Storage
}

describe('selection and board logic', () => {
  it('returns all points in a normalized rectangle', () => expect(getRectangleCells({ start: { row: 1, column: 2 }, end: { row: 0, column: 1 } })).toEqual([{ row: 0, column: 1 }, { row: 0, column: 2 }, { row: 1, column: 1 }, { row: 1, column: 2 }]))
  it('sums a selected rectangle and clears only an exact 10', () => { expect(sumSelection(board, { start: { row: 0, column: 0 }, end: { row: 1, column: 1 } })).toBe(12); expect(gameReducer(state(), { type: 'select', rect: successRect, now: 0 }).board.map((row) => row[0])).toEqual([null, null, null]) })
  it('does not score a repeated or invalid selection', () => { const once = gameReducer(state(), { type: 'select', rect: successRect, now: 0 }); expect(gameReducer(once, { type: 'select', rect: successRect, now: 1 }).score).toBe(3); expect(gameReducer(state(), { type: 'select', rect: { start: { row: 0, column: 0 }, end: { row: 0, column: 1 } }, now: 0 }).score).toBe(0) })
  it('allows a valid selection to span cleared cells and scores only removed fruit', () => {
    const crossed = gameReducer(state({ board: [[3, null, 7]] }), { type: 'select', rect: { start: { row: 0, column: 0 }, end: { row: 0, column: 2 } }, now: 0 })
    expect(crossed).toMatchObject({ board: [[null, null, null]], score: 2, clearedFruitCount: 2 })
  })
  it('generates a complete board with a known valid move', () => { const generated = generateBoard(() => 0.5); expect(generated).toHaveLength(BOARD_ROWS); expect(generated[0]).toHaveLength(BOARD_COLUMNS); expect(findValidMove(generated)).not.toBeNull() })
})

describe('moves, combo and hints', () => {
  it('finds a 10 rectangle and never selects cleared cells', () => { const move = findValidMove([[null, 1, 9]]); expect(move).toEqual({ start: { row: 0, column: 1 }, end: { row: 0, column: 2 } }) })
  it('reports no move when none exists', () => expect(findValidMove([[4, 4]])).toBeNull())
  it('reshuffles remaining fruit into a board with a valid move', () => expect(findValidMove(reshuffleRemaining([[4, 4, 4, 4]]))).not.toBeNull())
  it('increments combo in the mode window and clears it only when its timer expires', () => {
    const once = gameReducer(state(), { type: 'select', rect: successRect, now: 100 })
    const twice = gameReducer({ ...once, board }, { type: 'select', rect: successRect, now: 100 + getComboWindowMs('classic', 1) - 1 })
    const invalid = gameReducer(twice, { type: 'select', rect: { start: { row: 0, column: 0 }, end: { row: 0, column: 1 } }, now: 200 })
    expect(twice.combo).toBe(2)
    expect(invalid).toMatchObject({ combo: 2, comboDeadline: twice.comboDeadline, invalidMoves: 1 })
    expect(gameReducer(twice, { type: 'tick', now: twice.comboDeadline! + 1 }).combo).toBe(0)
  })
  it('does not let invalid input extend a combo, even after the deadline', () => {
    const active = state({ combo: 3, comboDeadline: 1_000 })
    const invalid = gameReducer(active, { type: 'select', rect: { start: { row: 0, column: 0 }, end: { row: 0, column: 1 } }, now: 1_001 })
    expect(invalid).toMatchObject({ combo: 0, comboDeadline: null, invalidMoves: 1 })
  })
  it('does not update a finished game and freezes timer/combo while paused', () => { const paused = gameReducer(state({ combo: 2, comboDeadline: 1_000 }), { type: 'pause', now: 100 }); expect(paused).toMatchObject({ nextTickAt: 900, comboDeadline: 900 }); expect(gameReducer(paused, { type: 'tick', now: 5_000 })).toBe(paused); const resumed = gameReducer(paused, { type: 'resume', now: 5_000 }); expect(resumed).toMatchObject({ nextTickAt: 5_900, comboDeadline: 5_900 }); const finished = state({ status: 'finished', nextTickAt: null }); expect(gameReducer(finished, { type: 'select', rect: successRect, now: 0 })).toBe(finished) })
  it('preserves fractional ticks across repeated pause and resume cycles', () => { let current = gameReducer(state({ combo: 2, comboDeadline: 4_000 }), { type: 'pause', now: 250 }); expect(current).toMatchObject({ secondsLeft: ROUND_SECONDS, nextTickAt: 750, comboDeadline: 3_750 }); current = gameReducer(current, { type: 'resume', now: 10_000 }); current = gameReducer(current, { type: 'pause', now: 10_250 }); expect(current).toMatchObject({ secondsLeft: ROUND_SECONDS, nextTickAt: 500, comboDeadline: 3_500 }); current = gameReducer(current, { type: 'resume', now: 20_000 }); current = gameReducer(current, { type: 'tick', now: 20_500 }); expect(current).toMatchObject({ secondsLeft: ROUND_SECONDS - 1, nextTickAt: 21_500 }) })
  it('accounts for elapsed ticks before pausing and blocks every paused mutation', () => { const paused = gameReducer(state(), { type: 'pause', now: 2_500 }); expect(paused).toMatchObject({ status: 'paused', secondsLeft: ROUND_SECONDS - 2, nextTickAt: 500 }); expect(gameReducer(paused, { type: 'select', rect: successRect, now: 3_000 })).toBe(paused); expect(gameReducer(paused, { type: 'use-hint' })).toBe(paused); expect(gameReducer(paused, { type: 'reshuffle' })).toBe(paused) })
  it('completes a full timed round and reaches the result state', () => { let current = state(); for (let second = 1; second <= ROUND_SECONDS; second += 1) current = gameReducer(current, { type: 'tick', now: second * 1_000 }); expect(current).toMatchObject({ secondsLeft: 0, nextTickAt: null, status: 'finished' }) })
  it('limits hints to the configured count', () => { let current = state(); current = gameReducer(current, { type: 'use-hint' }); current = gameReducer(current, { type: 'use-hint' }); current = gameReducer(current, { type: 'use-hint' }); expect(gameReducer(current, { type: 'use-hint' }).hintsUsed).toBe(3) })
})

describe('resilient local game data', () => {
  it('accumulates statistics independently by mode', () => { const next = recordFinishedRound(defaultStoredGameData, 'quick', 12, 12, 4, 6); expect(next.statisticsByMode.quick).toMatchObject({ highScore: 12, lastScore: 12, gamesPlayed: 1, totalCleared: 12, highestCombo: 4, totalScore: 12, bestClearsPerMinute: 6 }); expect(next.statisticsByMode.classic.gamesPlayed).toBe(0) })
  it('recovers from corrupt and older data', () => { const memory = storage(); memory.setItem('orchard-ten-v2', 'not-json'); expect(readGameData(memory)).toEqual(defaultStoredGameData); memory.setItem('orchard-ten-v2', JSON.stringify({ settings: { soundEnabled: false }, statistics: { highScore: 8 } })); expect(readGameData(memory).statisticsByMode.classic.highScore).toBe(8) })
  it('persists tutorial/settings and clears safely', () => { const memory = storage(); const saved = saveGameData({ ...defaultStoredGameData, tutorialSeen: true, settings: { ...defaultStoredGameData.settings, volume: 0.2 } }, memory); expect(readGameData(memory)).toEqual(saved); expect(clearGameData(memory)).toEqual(defaultStoredGameData); expect(readGameData(memory)).toEqual(defaultStoredGameData) })
  it('creates a fresh state with configured game duration', () => expect(createGameState().secondsLeft).toBe(ROUND_SECONDS))
  it('starts and restarts the selected timed mode', () => {
    const selected = gameReducer(createGameState('start', 0), { type: 'set-mode', mode: 'hard' })
    const started = gameReducer(selected, { type: 'start', now: 100 })
    expect(started).toMatchObject({ mode: 'hard', secondsLeft: 90, status: 'playing', nextTickAt: 1_100 })
    expect(gameReducer(started, { type: 'restart', now: 500 })).toMatchObject({ mode: 'hard', secondsLeft: 90, status: 'playing' })
  })
  it('uses each mode hint allowance at runtime', () => {
    const hard = state({ mode: 'hard', board: [[1, 9]] })
    const once = gameReducer(hard, { type: 'use-hint' })
    expect(once.hintsUsed).toBe(1)
    expect(gameReducer(once, { type: 'use-hint' })).toBe(once)
  })
})
