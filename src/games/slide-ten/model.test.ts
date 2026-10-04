import { describe, expect, it } from 'vitest'
import { BOARD_COLUMNS, BOARD_SIZE } from '../../game/constants'
import { INITIAL_FRUITS, createSlideState, screenDirection, slideFruit, slideReducer, type SlideBoard, type SlideState } from './model'

function emptyBoard(): SlideBoard { return Array(BOARD_SIZE).fill(null) }
function playing(board: SlideBoard): SlideState { return { ...createSlideState(), board, status: 'playing', lastTickAt: 1000 } }

describe('Slide Ten movement', () => {
  it.each([
    ['right', 1], ['left', -1], ['down', BOARD_COLUMNS], ['up', -BOARD_COLUMNS],
  ] as const)('clears 5 into adjacent 2 and 3 when sliding %s', (direction, step) => {
    const board = emptyBoard()
    const from = 4 * BOARD_COLUMNS + 8
    const first = from + step * 2
    const second = from + step * 3
    board[from] = 5; board[first] = 2; board[second] = 3
    const result = slideFruit(board, from, direction)
    expect(result).toMatchObject({ matched: true, moved: true, cleared: [from, first, second] })
    expect(result.board.filter(value => value !== null)).toHaveLength(0)
    expect(board[from]).toBe(5); expect(board[first]).toBe(2); expect(board[second]).toBe(3)
  })
  it('clears only the prefix summing to ten and leaves trailing fruit intact', () => {
    const board = emptyBoard(); board[1] = 5; board[2] = 2; board[3] = 3; board[4] = 8
    const result = slideFruit(board, 1, 'right')
    expect(result.cleared).toEqual([1, 2, 3])
    expect(result.board[4]).toBe(8)
  })
  it.each([
    ['right', 1], ['left', -1], ['down', BOARD_COLUMNS], ['up', -BOARD_COLUMNS],
  ] as const)('clears 5, 2, and 3 across empty cells when sliding %s', (direction, step) => {
    const board = emptyBoard()
    const from = 4 * BOARD_COLUMNS + 8
    const first = from + step * 2
    const second = from + step * 4
    board[from] = 5; board[first] = 2; board[second] = 3
    const state = slideReducer(playing(board), { type: 'slide', from, direction, now: 1000 })
    expect(state).toMatchObject({ score: 3, removedFruits: 3, pairs: 1 })
    expect(state.lastMove?.cleared).toEqual([from, first, second])
    expect(state.board.filter(value => value !== null)).toHaveLength(0)
  })
  it('skips multiple empty cells between each fruit and stops at the first total of ten', () => {
    const board = emptyBoard(); board[0] = 1; board[3] = 2; board[8] = 3; board[14] = 4; board[16] = 9
    const result = slideFruit(board, 0, 'right')
    expect(result.cleared).toEqual([0, 3, 8, 14])
    expect(result.board[16]).toBe(9)
    expect(result.board.filter(value => value !== null)).toHaveLength(1)
  })
  it('supports longer groups and records the actual cleared count and score', () => {
    const board = emptyBoard(); board[1] = 4; board[3] = 1; board[4] = 2; board[5] = 3
    const state = slideReducer(playing(board), { type: 'slide', from: 1, direction: 'right', now: 1000 })
    expect(state).toMatchObject({ score: 4, pairs: 1, removedFruits: 4 })
    expect(state.lastMove?.cleared).toEqual([1, 3, 4, 5])
  })
  it('does not skip intervening fruits, oversized sums, or row boundaries', () => {
    const over = emptyBoard(); over[1] = 5; over[4] = 2; over[5] = 4; over[6] = 3
    expect(slideFruit(over, 1, 'right')).toMatchObject({ matched: false, to: 3, cleared: [] })
    const edge = emptyBoard(); edge[14] = 5; edge[16] = 2; edge[17] = 3
    expect(slideFruit(edge, 14, 'right')).toMatchObject({ matched: false, to: 15, cleared: [] })
  })
  it('leaves the group intact and stops before the first fruit when the line stays below ten', () => {
    const board = emptyBoard(); board[1] = 5; board[4] = 2; board[9] = 1
    const result = slideFruit(board, 1, 'right')
    expect(result).toMatchObject({ matched: false, to: 3, cleared: [] })
    expect(result.board[3]).toBe(5); expect(result.board[4]).toBe(2); expect(result.board[9]).toBe(1)
  })
  it('uses the same 170 cells, with space to move and a guaranteed opening match', () => {
    for (let seed = 0; seed < 40; seed++) {
      const state = createSlideState(seed)
      expect(state.board).toHaveLength(170)
      expect(state.board.filter(value => value !== null)).toHaveLength(INITIAL_FRUITS)
      expect(slideFruit(state.board, 1, 'right').matched).toBe(true)
      expect(state.arrivals.every(arrival => state.board[arrival.index] === null)).toBe(true)
      expect(new Set(state.arrivals.map(arrival => arrival.index)).size).toBe(state.arrivals.length)
    }
  })
  it('removes a matching pair across a gap without mutating the input', () => {
    const board = emptyBoard(); board[1] = 4; board[5] = 6
    const moved = slideFruit(board, 1, 'right')
    expect(moved).toMatchObject({ matched: true, moved: true, to: 5 })
    expect(moved.board.filter(value => value !== null)).toHaveLength(0)
    expect(board[1]).toBe(4); expect(board[5]).toBe(6)
  })
  it('stops before a nonmatching fruit and cannot jump over it', () => {
    const board = emptyBoard(); board[1] = 4; board[5] = 2; board[7] = 6
    const moved = slideFruit(board, 1, 'right')
    expect(moved).toMatchObject({ matched: false, moved: true, to: 4 })
    expect(moved.board[4]).toBe(4); expect(moved.board[5]).toBe(2); expect(moved.board[7]).toBe(6)
  })
  it('stops at the edge and never wraps into another row', () => {
    const board = emptyBoard(); board[BOARD_COLUMNS - 1] = 4; board[BOARD_COLUMNS] = 6
    expect(slideFruit(board, BOARD_COLUMNS - 1, 'right')).toMatchObject({ moved: false, matched: false })
    board[3] = 7
    expect(slideFruit(board, 3, 'left').to).toBe(0)
  })
  it('matches vertically and maps screen directions to the transposed phone board', () => {
    const board = emptyBoard(); board[3] = 3; board[3 + BOARD_COLUMNS * 3] = 7
    expect(slideFruit(board, 3, 'down').matched).toBe(true)
    expect(screenDirection('down', true)).toBe('right')
    expect(screenDirection('up', true)).toBe('left')
    expect(screenDirection('right', true)).toBe('down')
    expect(screenDirection('left', true)).toBe('up')
    expect(screenDirection('right', false)).toBe('right')
  })
})

describe('Slide Ten clock and scoring', () => {
  it('counts each removed fruit once and does not score repositioning or elapsed time', () => {
    const board = emptyBoard(); board[1] = 4; board[4] = 6; board[20] = 3
    let state = slideReducer(playing(board), { type: 'slide', from: 1, direction: 'right', now: 1000 })
    expect(state).toMatchObject({ score: 2, removedFruits: 2, pairs: 1 })
    state = slideReducer(state, { type: 'slide', from: 20, direction: 'down', now: 1100 })
    expect(state).toMatchObject({ score: 2, removedFruits: 2 })
    state = slideReducer(state, { type: 'tick', now: 6000 })
    expect(state.score).toBe(2)
  })
  it('keeps the same per-fruit score across repeated fast matches', () => {
    let state = playing(emptyBoard())
    for (let round = 0; round < 25; round++) {
      const board = emptyBoard(); board[1] = 5; board[4] = 2; board[5] = 3
      state = slideReducer({ ...state, board }, { type: 'slide', from: 1, direction: 'right', now: 1000 + round * 100 })
      expect(state.score).toBe((round + 1) * 3)
      expect(state.score).toBe(state.removedFruits)
    }
  })
  it('preserves countdown and score during a long pause', () => {
    const board = emptyBoard(); board[1] = 4; board[4] = 6
    let state = slideReducer(playing(board), { type: 'slide', from: 1, direction: 'right', now: 1000 })
    state = slideReducer(state, { type: 'pause', now: 2000 })
    expect(state.untilWaveMs).toBe(3000)
    const paused = slideReducer(state, { type: 'tick', now: 100000 })
    expect(paused).toBe(state)
    state = slideReducer(paused, { type: 'resume', now: 100000 })
    state = slideReducer(state, { type: 'tick', now: 100100 })
    expect(state.elapsedMs).toBe(1100); expect(state.untilWaveMs).toBe(2900); expect(state.score).toBe(2)
  })
  it('adds exactly one batch on time and relocates previews without overwriting moved fruit', () => {
    let state = playing(emptyBoard())
    state.arrivals = [{ index: 2, value: 7 }, { index: 5, value: 3 }]
    state.waveCount = 2
    state.board[2] = 9
    state = slideReducer(state, { type: 'tick', now: 4999 })
    expect(state.board.filter(value => value !== null)).toHaveLength(1)
    state = slideReducer(state, { type: 'tick', now: 5000 })
    expect(state.board[2]).toBe(9)
    expect(state.board.filter(value => value !== null)).toHaveLength(3)
    expect(state.untilWaveMs).toBe(4000)
  })
  it('ends when space is insufficient and refuses further input', () => {
    const board: SlideBoard = Array(BOARD_SIZE).fill(5); board[0] = null
    let state = { ...playing(board), arrivals: [{ index: 0, value: 5 }] }
    state = slideReducer(state, { type: 'tick', now: 5000 })
    expect(state.status).toBe('ended')
    expect(state.board[0]).toBeNull()
    expect(state.untilWaveMs).toBe(0)
    expect(slideReducer(state, { type: 'slide', from: 1, direction: 'right', now: 5100 })).toBe(state)
  })
  it.each([0, 1, 3, 4])('ends without a partial batch when only %i spaces remain for four fruits', (spaces) => {
    const board: SlideBoard = Array(BOARD_SIZE).fill(9)
    board.fill(null, 0, spaces)
    const state = playing(board)
    expect(slideReducer(state, { type: 'tick', now: 4999 }).status).toBe('playing')
    const ended = slideReducer(state, { type: 'tick', now: 5000 })
    expect(ended.status).toBe('ended')
    expect(ended.board).toEqual(board)
  })
  it('adds the full batch when spaces exceed its count by one', () => {
    const board: SlideBoard = Array(BOARD_SIZE).fill(9); board.fill(null, 0, 5)
    const state = slideReducer(playing(board), { type: 'tick', now: 5000 })
    expect(state.status).toBe('playing')
    expect(state.board.filter(value => value === null)).toHaveLength(1)
  })
  it('allows a clear before the deadline to rescue even an incomplete preview', () => {
    const board: SlideBoard = Array(BOARD_SIZE).fill(9); board.fill(null, 0, 4)
    board[4] = 4; board[5] = 6
    let state = { ...playing(board), arrivals: [{ index: 0, value: 7 }] }
    expect(state.waveCount).toBe(4)
    state = slideReducer(state, { type: 'slide', from: 4, direction: 'right', now: 4999 })
    state = slideReducer(state, { type: 'tick', now: 5000 })
    expect(state.status).toBe('playing')
    expect(state.score).toBe(2)
    expect(state.board.filter(value => value === null)).toHaveLength(2)
  })
  it('rejects a last-second clear at the deadline when space is insufficient', () => {
    const board: SlideBoard = Array(BOARD_SIZE).fill(9); board.fill(null, 0, 4)
    board[4] = 4; board[5] = 6
    const state = slideReducer(playing(board), { type: 'slide', from: 4, direction: 'right', now: 5000 })
    expect(state.status).toBe('ended')
    expect(state.score).toBe(0)
    expect(state.board).toEqual(board)
  })
  it('processes missed clock ticks and resets all state for a fresh round', () => {
    let state = playing(emptyBoard())
    state = slideReducer(state, { type: 'tick', now: 13000 })
    expect(state.board.filter(value => value !== null)).toHaveLength(12)
    state = slideReducer({ ...state, score: 900 }, { type: 'start', seed: 99, now: 20000 })
    expect(state).toMatchObject({ score: 0, removedFruits: 0, elapsedMs: 0, untilWaveMs: 4000, status: 'playing', lastTickAt: 20000 })
  })
})
