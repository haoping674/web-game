import { generateBoard } from './boardGenerator'
import { ROUND_SECONDS, TARGET_SUM } from './constants'
import { getRectangleCells, sumSelection } from './selectionCalculator'
import type { GameState, GridRect } from './types'

export type GameAction =
  | { type: 'select'; rect: GridRect }
  | { type: 'tick' }
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'restart' }
  | { type: 'home' }

export function createGameState(status: GameState['status'] = 'start'): GameState {
  return { board: generateBoard(), score: 0, secondsLeft: ROUND_SECONDS, status }
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'select': return applySelection(state, action.rect)
    case 'tick': return state.status === 'playing'
      ? { ...state, secondsLeft: Math.max(0, state.secondsLeft - 1), status: state.secondsLeft <= 1 ? 'finished' : 'playing' }
      : state
    case 'start': return createGameState('playing')
    case 'pause': return state.status === 'playing' ? { ...state, status: 'paused' } : state
    case 'resume': return state.status === 'paused' ? { ...state, status: 'playing' } : state
    case 'restart': return createGameState('playing')
    case 'home': return createGameState('start')
    default: return assertNever(action)
  }
}

function applySelection(state: GameState, rect: GridRect): GameState {
  if (state.status !== 'playing' || sumSelection(state.board, rect) !== TARGET_SUM) return state
  const selected = getRectangleCells(rect).filter(({ row, column }) => state.board[row]?.[column] !== null)
  if (selected.length === 0) return state
  const board = state.board.map((row) => [...row])
  selected.forEach(({ row, column }) => { board[row]![column] = null })
  return { ...state, board, score: state.score + selected.length }
}

function assertNever(value: never): never {
  throw new Error(`Unknown action: ${JSON.stringify(value)}`)
}
