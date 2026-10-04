import { BOARD_COLUMNS, BOARD_ROWS, BOARD_SIZE, TARGET_SUM } from '../../game/constants'

export type Direction = 'up' | 'down' | 'left' | 'right'
export type SlideBoard = (number | null)[]
export type Arrival = { index: number; value: number }
export type SlideState = {
  status: 'ready' | 'playing' | 'paused' | 'ended'
  board: SlideBoard
  seed: number
  arrivals: Arrival[]
  waveCount: number
  untilWaveMs: number
  elapsedMs: number
  lastTickAt: number
  score: number
  pairs: number
  removedFruits: number
  moveId: number
  lastMove: { from: number; to: number; matched: boolean; cleared: number[]; points: number; atMs: number } | null
}
export const INITIAL_FRUITS = 84

function randomSource(seed: number) {
  let current = seed >>> 0
  return {
    next() { current = (Math.imul(current, 1664525) + 1013904223) >>> 0; return current / 4294967296 },
    seed() { return current },
  }
}

function planArrivals(board: SlideBoard, count: number, seed: number) {
  const rng = randomSource(seed)
  const empty = board.flatMap((value, index) => value === null ? [index] : [])
  const arrivals: Arrival[] = []
  for (let i = 0; i < count && empty.length > 0; i++) {
    const [index] = empty.splice(Math.floor(rng.next() * empty.length), 1)
    arrivals.push({ index: index!, value: 1 + Math.floor(rng.next() * 9) })
  }
  return { arrivals, waveCount: count, seed: rng.seed() }
}

export function waveSettings(elapsedMs: number) {
  const stage = Math.min(4, Math.floor(elapsedMs / 20_000))
  return { intervalMs: 4_000 - stage * 450, count: 4 + stage }
}

export function createSlideState(seed = 1): SlideState {
  const board: SlideBoard = Array(BOARD_SIZE).fill(null)
  // Keep an easy opening pair and a clear lane, even with an unlucky seed.
  const reserved = new Set([0, 1, 2, 3, 4, 5, 6])
  const rng = randomSource(seed)
  const slots = board.map((_, index) => index).filter((index) => !reserved.has(index))
  for (let i = 0; i < INITIAL_FRUITS - 2; i++) {
    const [index] = slots.splice(Math.floor(rng.next() * slots.length), 1)
    board[index!] = 1 + Math.floor(rng.next() * 9)
  }
  board[1] = 4
  board[4] = 6
  const planned = planArrivals(board, waveSettings(0).count, rng.seed())
  return {
    status: 'ready', board, ...planned, untilWaveMs: 4_000,
    elapsedMs: 0, lastTickAt: 0, score: 0,
    pairs: 0, removedFruits: 0, moveId: 0, lastMove: null,
  }
}

export function screenDirection(direction: Direction, portrait: boolean): Direction {
  if (!portrait) return direction
  return { up: 'left', down: 'right', left: 'up', right: 'down' }[direction] as Direction
}

export function slideFruit(board: SlideBoard, from: number, direction: Direction) {
  const value = board[from]
  const cleared: number[] = []
  if (value === null || value === undefined) return { board, to: from, matched: false, moved: false, cleared }
  const [dr, dc] = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] }[direction]!
  let row = Math.floor(from / BOARD_COLUMNS)
  let col = from % BOARD_COLUMNS
  let to = from
  let matched = false
  while (true) {
    row += dr!; col += dc!
    if (row < 0 || row >= BOARD_ROWS || col < 0 || col >= BOARD_COLUMNS) break
    const next = row * BOARD_COLUMNS + col
    if (board[next] !== null) {
      let total = value
      const group = [from]
      let scanRow = row
      let scanCol = col
      // Read fruits in order along the travel direction, ignoring empty cells.
      while (scanRow >= 0 && scanRow < BOARD_ROWS && scanCol >= 0 && scanCol < BOARD_COLUMNS) {
        const index = scanRow * BOARD_COLUMNS + scanCol
        const fruit = board[index]
        if (fruit !== null && fruit !== undefined) {
          total += fruit
          group.push(index)
          if (total >= TARGET_SUM) {
            if (total === TARGET_SUM) { to = next; matched = true; cleared.push(...group) }
            break
          }
        }
        scanRow += dr!; scanCol += dc!
      }
      break
    }
    to = next
  }
  if (to === from) return { board, to, matched: false, moved: false, cleared }
  const updated = [...board]
  updated[from] = null
  updated[to] = matched ? null : value
  for (const index of cleared) updated[index] = null
  return { board: updated, to, matched, moved: true, cleared }
}

function advance(state: SlideState, now: number): SlideState {
  if (state.status !== 'playing') return state
  const delta = Math.max(0, now - state.lastTickAt)
  let next: SlideState = {
    ...state, elapsedMs: state.elapsedMs + delta,
    lastTickAt: Math.max(now, state.lastTickAt), untilWaveMs: state.untilWaveMs - delta,
  }
  while (next.untilWaveMs <= 0 && next.status === 'playing') {
    if (next.board.filter(value => value === null).length <= next.waveCount) {
      next = { ...next, status: 'ended', untilWaveMs: 0 }
      break
    }
    const board = [...next.board]
    for (const arrival of next.arrivals) {
      // A player may move into a preview cell. Find another empty cell instead.
      const index = board[arrival.index] === null ? arrival.index : board.indexOf(null)
      if (index === -1) break
      board[index] = arrival.value
    }
    // Clearing before the deadline can rescue a board with too few preview slots.
    const extra = planArrivals(board, next.waveCount - next.arrivals.length, next.seed)
    for (const arrival of extra.arrivals) board[arrival.index] = arrival.value
    const waveTime = next.elapsedMs + next.untilWaveMs
    const settings = waveSettings(waveTime)
    next = { ...next, board, untilWaveMs: next.untilWaveMs + settings.intervalMs, ...planArrivals(board, settings.count, extra.seed) }
  }
  return next
}

export type SlideAction =
  | { type: 'start'; seed: number; now: number }
  | { type: 'tick' | 'pause' | 'resume'; now: number }
  | { type: 'slide'; from: number; direction: Direction; now: number }

export function slideReducer(state: SlideState, action: SlideAction): SlideState {
  if (action.type === 'start') return { ...createSlideState(action.seed), status: 'playing', lastTickAt: action.now }
  if (action.type === 'resume') return state.status === 'paused' ? { ...state, status: 'playing', lastTickAt: action.now } : state
  if (state.status !== 'playing') return state
  const next = advance(state, action.now)
  if (action.type === 'pause') return next.status === 'playing' ? { ...next, status: 'paused' } : next
  if (action.type !== 'slide' || next.status !== 'playing') return next
  const move = slideFruit(next.board, action.from, action.direction)
  if (!move.moved) return next
  const points = move.cleared.length
  return {
    ...next, board: move.board, score: next.score + points,
    pairs: next.pairs + Number(move.matched),
    removedFruits: next.removedFruits + move.cleared.length,
    moveId: next.moveId + 1,
    lastMove: { from: action.from, to: move.to, matched: move.matched, cleared: move.cleared, points, atMs: next.elapsedMs },
  }
}
