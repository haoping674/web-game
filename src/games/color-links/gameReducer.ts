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
  | { type: 'resolve-stranded' }
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
    elapsedSeconds: 0,
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
  return {
    ...state,
    elapsedSeconds: state.elapsedSeconds + elapsedTicks,
    nextTickAt: state.nextTickAt + elapsedTicks * 1_000,
  }
}

function selectCell(state: ColorLinksState, position: CellPosition, now: number): ColorLinksState {
  const current = advanceTime(state, now)
  if (current.status !== 'playing') return current
  if (current.board[position.row]?.[position.column] !== null) return current
  const matches = findMatchesAtCell(current.board, position)
  if (matches.length === 0) {
    return {
      ...current,
      elapsedSeconds: current.elapsedSeconds + COLOR_LINKS_CONFIG.invalidPenaltySeconds,
      invalidMoves: current.invalidMoves + 1,
    }
  }
  const removedTiles = matches.reduce((total, match) => total + match.tiles.length, 0)
  const board = removeMatchedTiles(current.board, matches)
  const completed = board.every((row) => row.every((cell) => cell === null))
  return {
    ...current,
    board,
    score: current.score + calculateColorLinkScore(matches),
    successfulMoves: current.successfulMoves + 1,
    removedTiles: current.removedTiles + removedTiles,
    status: completed ? 'finished' : 'playing',
    nextTickAt: completed ? null : current.nextTickAt,
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
    case 'resolve-stranded': {
      if (state.status !== 'playing') return state
      const strandedTiles = state.board.reduce(
        (total, row) => total + row.filter((cell) => cell !== null).length,
        0,
      )
      return {
        ...state,
        board: state.board.map((row) => row.map(() => null)),
        removedTiles: state.removedTiles + strandedTiles,
        status: 'finished',
        nextTickAt: null,
      }
    }
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
