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
  | { type: 'start'; now: number }
  | { type: 'pause'; now: number }
  | { type: 'resume'; now: number }
  | { type: 'restart'; now: number }
  | { type: 'home' }

export function createGameState(status: GameState['status'] = 'start', now = Date.now()): GameState {
  return { board: generateBoard(), score: 0, secondsLeft: ROUND_SECONDS, nextTickAt: status === 'playing' ? now + 1_000 : null, status, combo: 0, bestCombo: 0, comboDeadline: null, successfulMoves: 0, invalidMoves: 0, hintsUsed: 0 }
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'select': return applySelection(state, action.rect, action.now)
    case 'tick': return advancePlayingTime(state, action.now)
    case 'use-hint': return state.status === 'playing' && state.hintsUsed < HINT_LIMIT ? { ...state, hintsUsed: state.hintsUsed + 1 } : state
    case 'reshuffle': return state.status === 'playing' ? { ...state, board: reshuffleRemaining(state.board) } : state
    case 'start': return createGameState('playing', action.now)
    case 'pause': return pausePlayingTime(state, action.now)
    case 'resume': return state.status === 'paused' ? { ...state, status: 'playing', nextTickAt: state.nextTickAt === null ? null : action.now + state.nextTickAt, comboDeadline: state.comboDeadline === null ? null : action.now + state.comboDeadline } : state
    case 'restart': return createGameState('playing', action.now)
    case 'home': return createGameState('start')
    default: return assertNever(action)
  }
}

function advancePlayingTime(state: GameState, now: number): GameState {
  if (state.status !== 'playing') return state
  const comboExpired = state.comboDeadline !== null && now > state.comboDeadline
  if (state.nextTickAt === null || now < state.nextTickAt) {
    return comboExpired ? { ...state, combo: 0, comboDeadline: null } : state
  }
  const elapsedTicks = Math.floor((now - state.nextTickAt) / 1_000) + 1
  const secondsLeft = Math.max(0, state.secondsLeft - elapsedTicks)
  return {
    ...state,
    secondsLeft,
    nextTickAt: secondsLeft === 0 ? null : state.nextTickAt + elapsedTicks * 1_000,
    status: secondsLeft === 0 ? 'finished' : 'playing',
    combo: comboExpired ? 0 : state.combo,
    comboDeadline: comboExpired ? null : state.comboDeadline,
  }
}

function pausePlayingTime(state: GameState, now: number): GameState {
  if (state.status !== 'playing') return state
  const advanced = advancePlayingTime(state, now)
  if (advanced.status !== 'playing') return advanced
  return {
    ...advanced,
    status: 'paused',
    nextTickAt: advanced.nextTickAt === null ? null : Math.max(0, advanced.nextTickAt - now),
    comboDeadline: advanced.comboDeadline === null ? null : Math.max(0, advanced.comboDeadline - now),
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
