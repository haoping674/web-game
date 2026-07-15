import { describe, expect, it } from 'vitest'
import { generateBoard } from './boardGenerator'
import { BOARD_COLUMNS, BOARD_ROWS, ROUND_SECONDS } from './constants'
import { gameReducer } from './gameReducer'
import { getRectangleCells, sumSelection } from './selectionCalculator'
import { readHighScore, saveHighScore } from './storage'
import type { GameState } from './types'

const board = [[1, 2, 3], [4, 5, 6], [5, 8, 9]]
const state = (overrides: Partial<GameState> = {}): GameState => ({ board, score: 0, secondsLeft: ROUND_SECONDS, status: 'playing', ...overrides })

describe('數字果園核心邏輯', () => {
  it('正確取得矩形內所有格子', () => expect(getRectangleCells({ start: { row: 0, column: 1 }, end: { row: 1, column: 2 } })).toEqual([{ row: 0, column: 1 }, { row: 0, column: 2 }, { row: 1, column: 1 }, { row: 1, column: 2 }]))
  it('正確計算選取總和', () => expect(sumSelection(board, { start: { row: 0, column: 0 }, end: { row: 1, column: 1 } })).toBe(12))
  it('總和等於 10 時能消除格子', () => expect(gameReducer(state(), { type: 'select', rect: { start: { row: 0, column: 0 }, end: { row: 2, column: 0 } } }).board.map((row) => row[0])).toEqual([null, null, null]))
  it('總和不等於 10 時棋盤不變', () => { const initial = state(); expect(gameReducer(initial, { type: 'select', rect: { start: { row: 0, column: 0 }, end: { row: 0, column: 1 } } }).board).toBe(initial.board) })
  it('分數依消除水果數量增加', () => expect(gameReducer(state(), { type: 'select', rect: { start: { row: 0, column: 0 }, end: { row: 2, column: 0 } } }).score).toBe(3))
  it('已消除格子不重複計分', () => { const once = gameReducer(state(), { type: 'select', rect: { start: { row: 0, column: 0 }, end: { row: 2, column: 0 } } }); expect(gameReducer(once, { type: 'select', rect: { start: { row: 0, column: 0 }, end: { row: 2, column: 0 } } }).score).toBe(3) })
  it('倒數結束後不能繼續操作', () => { const finished = state({ secondsLeft: 0, status: 'finished' }); expect(gameReducer(finished, { type: 'select', rect: { start: { row: 0, column: 0 }, end: { row: 2, column: 0 } } })).toBe(finished) })
  it('重新開始會重置棋盤、分數與時間', () => { const reset = gameReducer(state({ score: 9, secondsLeft: 1 }), { type: 'restart' }); expect([reset.score, reset.secondsLeft, reset.board.length, reset.board[0]?.length]).toEqual([0, ROUND_SECONDS, BOARD_ROWS, BOARD_COLUMNS]) })
  it('隨機棋盤總有至少一組有效解', () => { const generated = generateBoard(() => 0.5); const total = generated.flat().reduce<number>((sum, value) => sum + (value ?? 0), 0); expect(total % 10).toBe(0); expect(generated[9]!.slice(15)).toEqual([1, 9]) })
  it('localStorage 能保存最高分', () => { const memory = new Map<string, string>(); const storage = { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value), removeItem: () => undefined, clear: () => undefined, key: () => null, length: 0 } as Storage; expect(saveHighScore(8, storage)).toBe(8); expect(saveHighScore(4, storage)).toBe(8); expect(readHighScore(storage)).toBe(8) })
})
