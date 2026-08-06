import type { NumberPathPosition, NumberPathState } from './types'

export type NumberPathAction =
  | { type: 'choose-level'; levelId: string; now: number }
  | { type: 'move'; position: NumberPathPosition; completed: boolean }
  | { type: 'invalid-move' }
  | { type: 'use-hint' }
  | { type: 'undo' }
  | { type: 'restart'; now: number }
  | { type: 'return-to-levels' }
  | { type: 'pause'; now: number }
  | { type: 'resume'; now: number }
  | { type: 'tick'; now: number }

export function createNumberPathState(): NumberPathState {
  return {
    status: 'selecting',
    levelId: null,
    path: [],
    elapsedSeconds: 0,
    nextTickAt: null,
    errors: 0,
    hintsUsed: 0,
  }
}

function advanceTime(state: NumberPathState, now: number): NumberPathState {
  if (state.status !== 'playing' || state.nextTickAt === null || now < state.nextTickAt) return state
  const elapsedTicks = Math.floor((now - state.nextTickAt) / 1_000) + 1
  return {
    ...state,
    elapsedSeconds: state.elapsedSeconds + elapsedTicks,
    nextTickAt: state.nextTickAt + elapsedTicks * 1_000,
  }
}

function restartLevel(state: NumberPathState, now: number): NumberPathState {
  if (!state.levelId) return state
  return {
    ...state,
    status: 'playing',
    path: [],
    elapsedSeconds: 0,
    nextTickAt: now + 1_000,
    errors: 0,
    hintsUsed: 0,
  }
}

export function numberPathReducer(state: NumberPathState, action: NumberPathAction): NumberPathState {
  switch (action.type) {
    case 'choose-level':
      return {
        status: 'playing',
        levelId: action.levelId,
        path: [],
        elapsedSeconds: 0,
        nextTickAt: action.now + 1_000,
        errors: 0,
        hintsUsed: 0,
      }
    case 'move': {
      if (state.status !== 'playing') return state
      const path = [...state.path, action.position]
      return {
        ...state,
        path,
        status: action.completed ? 'finished' : 'playing',
        nextTickAt: action.completed ? null : state.nextTickAt,
      }
    }
    case 'invalid-move':
      return state.status === 'playing' ? { ...state, errors: state.errors + 1 } : state
    case 'use-hint':
      return state.status === 'playing' ? { ...state, hintsUsed: state.hintsUsed + 1 } : state
    case 'undo':
      return state.status === 'playing' && state.path.length > 0
        ? { ...state, path: state.path.slice(0, -1) }
        : state
    case 'restart':
      return restartLevel(state, action.now)
    case 'return-to-levels':
      return createNumberPathState()
    case 'pause': {
      const current = advanceTime(state, action.now)
      return current.status === 'playing'
        ? {
            ...current,
            status: 'paused',
            nextTickAt: current.nextTickAt === null ? null : Math.max(0, current.nextTickAt - action.now),
          }
        : current
    }
    case 'resume':
      return state.status === 'paused'
        ? {
            ...state,
            status: 'playing',
            nextTickAt: state.nextTickAt === null ? null : action.now + state.nextTickAt,
          }
        : state
    case 'tick':
      return advanceTime(state, action.now)
    default:
      return assertNever(action)
  }
}

function assertNever(value: never): never {
  throw new Error(`Unknown Number Path action: ${JSON.stringify(value)}`)
}
