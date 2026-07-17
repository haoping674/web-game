import { generateBoard } from './boardGenerator'
import { getComboWindowMs } from './comboConfig'
import { getModeHintLimit, getModeRoundSeconds } from './modes'
import { getRectangleCells } from './selectionCalculator'
import { calculateMoveScore } from './scoring'
import { findValidMove, isValidMove, reshuffleRemaining } from './validMoveFinder'
import type { PlayableMode } from './modes'
import type { GameState, GridRect } from './types'

export type GameAction =
  | { type: 'select'; rect: GridRect; now: number }
  | { type: 'tick'; now: number }
  | { type: 'use-hint' }
  | { type: 'reshuffle' }
  | { type: 'set-mode'; mode: PlayableMode }
  | { type: 'start'; now: number }
  | { type: 'pause'; now: number }
  | { type: 'resume'; now: number }
  | { type: 'restart'; now: number }
  | { type: 'home' }

export function createGameState(status: GameState['status'] = 'start', now = Date.now(), mode: PlayableMode = 'classic'): GameState {
  return { mode, board: generateBoard(Math.random, mode), score: 0, clearedFruitCount: 0, secondsLeft: getModeRoundSeconds(mode), nextTickAt: status === 'playing' ? now + 1_000 : null, status, combo: 0, bestCombo: 0, comboDeadline: null, successfulMoves: 0, invalidMoves: 0, hintsUsed: 0, systemReshuffles: 0 }
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'select': return applySelection(state, action.rect, action.now)
    case 'tick': return advancePlayingTime(state, action.now)
    case 'use-hint': return state.status === 'playing' && state.hintsUsed < getModeHintLimit(state.mode) && findValidMove(state.board) ? { ...state, hintsUsed: state.hintsUsed + 1 } : state
    case 'reshuffle': return applyReshuffle(state)
    case 'set-mode': return state.status === 'start' ? { ...state, mode: action.mode, secondsLeft: getModeRoundSeconds(action.mode) } : state
    case 'start': return createGameState('playing', action.now, state.mode)
    case 'pause': return pausePlayingTime(state, action.now)
    case 'resume': return state.status === 'paused' ? { ...state, status: 'playing', nextTickAt: state.nextTickAt === null ? null : action.now + state.nextTickAt, comboDeadline: state.comboDeadline === null ? null : action.now + state.comboDeadline } : state
    case 'restart': return createGameState('playing', action.now, state.mode)
    case 'home': return createGameState('start', Date.now(), state.mode)
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
    combo: secondsLeft === 0 || comboExpired ? 0 : state.combo,
    comboDeadline: secondsLeft === 0 || comboExpired ? null : state.comboDeadline,
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
  if (!isValidMove(state.board, rect)) return { ...state, combo: 0, comboDeadline: null, invalidMoves: state.invalidMoves + 1 }
  const selected = getRectangleCells(rect).filter(({ row, column }) => state.board[row]?.[column] !== null)
  if (selected.length === 0) return { ...state, combo: 0, comboDeadline: null, invalidMoves: state.invalidMoves + 1 }
  const board = state.board.map((row) => [...row])
  selected.forEach(({ row, column }) => { board[row]![column] = null })
  const combo = state.comboDeadline !== null && now <= state.comboDeadline ? state.combo + 1 : 1
  const moveScore = calculateMoveScore({ fruitCount: selected.length, rectangleArea: getRectangleCells(rect).length, combo })
  return { ...state, board, score: state.score + moveScore.total, clearedFruitCount: state.clearedFruitCount + selected.length, combo, bestCombo: Math.max(state.bestCombo, combo), comboDeadline: now + getComboWindowMs(state.mode, combo), successfulMoves: state.successfulMoves + 1 }
}

function applyReshuffle(state: GameState): GameState {
  if (state.status !== 'playing') return state
  if (findValidMove(state.board) !== null) return state
  const remainingFruit = state.board.flat().filter((value) => value !== null).length
  if (remainingFruit < 2) return state
  return { ...state, board: reshuffleRemaining(state.board), systemReshuffles: state.systemReshuffles + 1 }
}

function assertNever(value: never): never { throw new Error(`Unknown action: ${JSON.stringify(value)}`) }
