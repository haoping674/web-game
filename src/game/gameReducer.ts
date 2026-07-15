import { generateBoard } from './boardGenerator'
import { COMBO_WINDOW_MS, HINT_LIMIT, ROUND_SECONDS, TARGET_SUM } from './constants'
import { getRectangleCells, sumSelection } from './selectionCalculator'
import { reshuffleRemaining } from './validMoveFinder'
import type { GameState, GridRect } from './types'

export type GameAction =
  | { type: 'select'; rect: GridRect; now: number }
  | { type: 'tick'; now: number }
  | { type: 'use-hint' }
  | { type: 'reshuffle' }
  | { type: 'start' }
  | { type: 'pause'; now: number }
  | { type: 'resume'; now: number }
  | { type: 'restart' }
  | { type: 'home' }

export function createGameState(status: GameState['status'] = 'start'): GameState {
  return { board: generateBoard(), score: 0, secondsLeft: ROUND_SECONDS, status, combo: 0, bestCombo: 0, comboDeadline: null, successfulMoves: 0, invalidMoves: 0, hintsUsed: 0 }
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'select': return applySelection(state, action.rect, action.now)
    case 'tick': return state.status === 'playing'
      ? { ...state, combo: state.comboDeadline !== null && action.now > state.comboDeadline ? 0 : state.combo, comboDeadline: state.comboDeadline !== null && action.now > state.comboDeadline ? null : state.comboDeadline, secondsLeft: Math.max(0, state.secondsLeft - 1), status: state.secondsLeft <= 1 ? 'finished' : 'playing' }
      : state
    case 'use-hint': return state.status === 'playing' && state.hintsUsed < HINT_LIMIT ? { ...state, hintsUsed: state.hintsUsed + 1 } : state
    case 'reshuffle': return state.status === 'playing' ? { ...state, board: reshuffleRemaining(state.board) } : state
    case 'start': return createGameState('playing')
    case 'pause': return state.status === 'playing' ? { ...state, status: 'paused', comboDeadline: state.comboDeadline === null ? null : state.comboDeadline - action.now } : state
    case 'resume': return state.status === 'paused' ? { ...state, status: 'playing', comboDeadline: state.comboDeadline === null ? null : action.now + state.comboDeadline } : state
    case 'restart': return createGameState('playing')
    case 'home': return createGameState('start')
    default: return assertNever(action)
  }
}

function applySelection(state: GameState, rect: GridRect, now: number): GameState {
  if (state.status !== 'playing') return state
  if (sumSelection(state.board, rect) !== TARGET_SUM) return { ...state, combo: 0, comboDeadline: null, invalidMoves: state.invalidMoves + 1 }
  const selected = getRectangleCells(rect).filter(({ row, column }) => state.board[row]?.[column] !== null)
  if (selected.length === 0) return { ...state, combo: 0, comboDeadline: null, invalidMoves: state.invalidMoves + 1 }
  const board = state.board.map((row) => [...row])
  selected.forEach(({ row, column }) => { board[row]![column] = null })
  const combo = state.comboDeadline !== null && now <= state.comboDeadline ? state.combo + 1 : 1
  return { ...state, board, score: state.score + selected.length, combo, bestCombo: Math.max(state.bestCombo, combo), comboDeadline: now + COMBO_WINDOW_MS, successfulMoves: state.successfulMoves + 1 }
}

function assertNever(value: never): never { throw new Error(`Unknown action: ${JSON.stringify(value)}`) }
