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
  // The timer remains authoritative when interaction arrives after a scheduled wake-up.
  // Invalid selections never reset or extend it.
  const current = advancePlayingTime(state, now)
  if (current.status !== 'playing') return current
  if (!isValidMove(current.board, rect)) return { ...current, invalidMoves: current.invalidMoves + 1 }
  const selected = getRectangleCells(rect).filter(({ row, column }) => current.board[row]?.[column] !== null)
  if (selected.length === 0) return { ...current, invalidMoves: current.invalidMoves + 1 }
  const board = current.board.map((row) => [...row])
  selected.forEach(({ row, column }) => { board[row]![column] = null })
  const combo = current.comboDeadline !== null && now <= current.comboDeadline ? current.combo + 1 : 1
  const moveScore = calculateMoveScore({ fruitCount: selected.length, rectangleArea: getRectangleCells(rect).length, combo })
  return { ...current, board, score: current.score + moveScore.total, clearedFruitCount: current.clearedFruitCount + selected.length, combo, bestCombo: Math.max(current.bestCombo, combo), comboDeadline: now + getComboWindowMs(current.mode, combo), successfulMoves: current.successfulMoves + 1 }
}

function applyReshuffle(state: GameState): GameState {
  if (state.status !== 'playing') return state
  if (findValidMove(state.board) !== null) return state
  const remainingFruit = state.board.flat().filter((value) => value !== null).length
  if (remainingFruit < 2) return state
  return { ...state, board: reshuffleRemaining(state.board), systemReshuffles: state.systemReshuffles + 1 }
}

function assertNever(value: never): never { throw new Error(`Unknown action: ${JSON.stringify(value)}`) }
