import { findMatchesAtCell, generateBoard, removeMatchedTiles } from './board'
import { COLOR_LINKS_CONFIG } from './config'
import type { CellPosition, ColorLinksBoard, ColorLinksState, MatchGroup } from './types'

export type ColorLinksAction =
  | { type: 'start'; now: number; board?: ColorLinksBoard }
  | { type: 'select'; position: CellPosition; now: number }
  | { type: 'tick'; now: number }
  | { type: 'pause'; now: number }
  | { type: 'resume'; now: number }
  | { type: 'restart'; now: number; board?: ColorLinksBoard }
  | { type: 'reshuffle'; board: ColorLinksBoard }
  | { type: 'finish' }

export function calculateColorLinkScore(matches: readonly MatchGroup[]): number {
  const removed = matches.reduce((total, match) => total + match.tiles.length, 0)
  const independentGroupBonus = Math.max(0, matches.length - 1)
  return removed + independentGroupBonus
}

export function createColorLinksState(
  status: ColorLinksState['status'] = 'ready',
  now = Date.now(),
  board = generateBoard(),
): ColorLinksState {
  return {
    board,
    status,
    score: 0,
    secondsLeft: COLOR_LINKS_CONFIG.roundSeconds,
    nextTickAt: status === 'playing' ? now + 1_000 : null,
    successfulMoves: 0,
    invalidMoves: 0,
    removedTiles: 0,
    reshuffles: 0,
  }
}

function advanceTime(state: ColorLinksState, now: number): ColorLinksState {
  if (state.status !== 'playing' || state.nextTickAt === null || now < state.nextTickAt) return state
  const elapsedTicks = Math.floor((now - state.nextTickAt) / 1_000) + 1
  const secondsLeft = Math.max(0, state.secondsLeft - elapsedTicks)
  return {
    ...state,
    secondsLeft,
    status: secondsLeft === 0 ? 'finished' : 'playing',
    nextTickAt: secondsLeft === 0 ? null : state.nextTickAt + elapsedTicks * 1_000,
  }
}

function selectCell(state: ColorLinksState, position: CellPosition, now: number): ColorLinksState {
  const current = advanceTime(state, now)
  if (current.status !== 'playing') return current
  if (current.board[position.row]?.[position.column] !== null) return current
  const matches = findMatchesAtCell(current.board, position)
  if (matches.length === 0) {
    const secondsLeft = Math.max(0, current.secondsLeft - COLOR_LINKS_CONFIG.invalidPenaltySeconds)
    return {
      ...current,
      secondsLeft,
      invalidMoves: current.invalidMoves + 1,
      status: secondsLeft === 0 ? 'finished' : 'playing',
      nextTickAt: secondsLeft === 0 ? null : current.nextTickAt,
    }
  }
  const removedTiles = matches.reduce((total, match) => total + match.tiles.length, 0)
  return {
    ...current,
    board: removeMatchedTiles(current.board, matches),
    score: current.score + calculateColorLinkScore(matches),
    successfulMoves: current.successfulMoves + 1,
    removedTiles: current.removedTiles + removedTiles,
  }
}

function pause(state: ColorLinksState, now: number): ColorLinksState {
  const current = advanceTime(state, now)
  if (current.status !== 'playing') return current
  return {
    ...current,
    status: 'paused',
    nextTickAt: current.nextTickAt === null ? null : Math.max(0, current.nextTickAt - now),
  }
}

export function colorLinksReducer(state: ColorLinksState, action: ColorLinksAction): ColorLinksState {
  switch (action.type) {
    case 'start':
      return createColorLinksState('playing', action.now, action.board ?? generateBoard())
    case 'restart':
      return createColorLinksState('playing', action.now, action.board ?? generateBoard())
    case 'select':
      return selectCell(state, action.position, action.now)
    case 'tick':
      return advanceTime(state, action.now)
    case 'pause':
      return pause(state, action.now)
    case 'resume':
      return state.status === 'paused'
        ? {
            ...state,
            status: 'playing',
            nextTickAt: state.nextTickAt === null ? null : action.now + state.nextTickAt,
          }
        : state
    case 'reshuffle':
      return state.status === 'playing'
        ? { ...state, board: action.board, reshuffles: state.reshuffles + 1 }
        : state
    case 'finish':
      return state.status === 'playing' || state.status === 'paused'
        ? { ...state, status: 'finished', nextTickAt: null }
        : state
    default:
      return assertNever(action)
  }
}

function assertNever(value: never): never {
  throw new Error(`Unknown Color Links action: ${JSON.stringify(value)}`)
}
