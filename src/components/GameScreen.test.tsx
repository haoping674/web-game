// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { GameAction } from '../game/gameReducer'
import type { GameSettings, GameState } from '../game/types'
import { GameBoard } from './GameBoard'
import { GameScreen } from './GameScreen'

const settings: GameSettings = { soundEnabled: false, volume: 0.5, animationsEnabled: true, animationIntensity: 'full', lowStimulus: false, hapticsEnabled: false, showSelectionHelp: true }
const board = [[1, 9], [null, 2]]
const playingGame: GameState = { mode: 'classic', board, score: 12, clearedFruitCount: 12, secondsLeft: 42, nextTickAt: Date.now() + 1_000, status: 'playing', combo: 2, bestCombo: 3, comboDeadline: Date.now() + 2_000, successfulMoves: 1, invalidMoves: 0, hintsUsed: 0, systemReshuffles: 0 }

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  })
})

function gameScreen(game: GameState, dispatch = vi.fn<(action: GameAction) => void>()) {
  return <GameScreen game={game} dispatch={dispatch} settings={settings} tutorialOpen={false} onPause={vi.fn()} onRestart={vi.fn()} onOpenSettings={vi.fn()} networkNotice={null} />
}

describe('paused board privacy', () => {
  it('removes every fruit, empty cell, hint, and board control from the paused DOM', () => {
    const paused = { ...playingGame, status: 'paused', nextTickAt: 650, comboDeadline: 1_650 } satisfies GameState
    const { container } = render(gameScreen(paused))
    expect(screen.queryByRole('grid')).toBeNull()
    expect(container.querySelector('.fruit-cell')).toBeNull()
    expect(container.querySelector('.is-empty')).toBeNull()
    expect(container.querySelector('.selection-overlay')).toBeNull()
    expect(container.querySelector('.paused-board')).not.toBeNull()
    expect(screen.queryByRole('button', { name: /提示/ })).toBeNull()
    expect(container.querySelector('.play-screen')).toHaveAttribute('inert')
    expect(container.querySelector('.play-screen')).toHaveAttribute('aria-hidden', 'true')
    for (const control of container.querySelectorAll<HTMLButtonElement>('.play-topbar button, .icon-button')) {
      expect(control).toBeDisabled()
    }
  })

  it('restores the unchanged board only after play resumes', () => {
    const paused = { ...playingGame, status: 'paused', nextTickAt: 650, comboDeadline: 1_650 } satisfies GameState
    const { container, rerender } = render(gameScreen(paused))
    rerender(gameScreen(playingGame))
    expect(screen.getByRole('grid', { name: '水果數字棋盤' })).toBeInTheDocument()
    expect(container.querySelectorAll('.fruit-cell')).toHaveLength(4)
    expect(screen.getByText('9')).toBeInTheDocument()
  })
})

describe('selection cancellation', () => {
  it('supports a vertical single-touch selection', () => {
    const verticalBoard = Array.from({ length: 10 }, () => Array<null | number>(17).fill(null))
    verticalBoard[0]![0] = 4
    verticalBoard[1]![0] = 6
    const onSelectionEnd = vi.fn()
    const { container } = render(<GameBoard board={verticalBoard} onSelectionEnd={onSelectionEnd} />)
    const grid = within(container).getByRole('grid')
    vi.spyOn(grid, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 170, bottom: 100, width: 170, height: 100, toJSON: () => ({}) })
    fireEvent.pointerDown(grid, { pointerId: 3, pointerType: 'touch', clientX: 5, clientY: 5 })
    fireEvent.pointerMove(grid, { pointerId: 3, pointerType: 'touch', clientX: 5, clientY: 15 })
    fireEvent.pointerUp(grid, { pointerId: 3, pointerType: 'touch', clientX: 5, clientY: 15 })
    expect(onSelectionEnd).toHaveBeenCalledWith({ start: { row: 0, column: 0 }, end: { row: 1, column: 0 } }, 10)
  })

  it('does not submit a drag that is disabled before pointerup', () => {
    const onSelectionEnd = vi.fn()
    const { container, rerender } = render(<GameBoard board={board} onSelectionEnd={onSelectionEnd} />)
    const grid = within(container).getByRole('grid')
    vi.spyOn(grid, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100, toJSON: () => ({}) })
    fireEvent.pointerDown(grid, { pointerId: 1, clientX: 10, clientY: 10 })
    rerender(<GameBoard board={board} onSelectionEnd={onSelectionEnd} disabled />)
    fireEvent.pointerUp(grid, { pointerId: 1, clientX: 190, clientY: 90 })
    expect(onSelectionEnd).not.toHaveBeenCalled()
  })

  it('treats pointer cancellation as cancellation, never as a completed move', () => {
    const onSelectionEnd = vi.fn()
    const { container } = render(<GameBoard board={board} onSelectionEnd={onSelectionEnd} />)
    const grid = within(container).getByRole('grid')
    vi.spyOn(grid, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100, toJSON: () => ({}) })
    fireEvent.pointerDown(grid, { pointerId: 2, clientX: 10, clientY: 10 })
    fireEvent.pointerCancel(grid, { pointerId: 2 })
    expect(onSelectionEnd).not.toHaveBeenCalled()
  })

  it('cancels immediately on a second touch and resumes only after every touch leaves', () => {
    const onSelectionEnd = vi.fn()
    const { container } = render(<GameBoard board={board} onSelectionEnd={onSelectionEnd} />)
    const grid = within(container).getByRole('grid')
    vi.spyOn(grid, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100, toJSON: () => ({}) })
    fireEvent.pointerDown(grid, { pointerId: 10, pointerType: 'touch', clientX: 5, clientY: 5 })
    expect(container.querySelector('.selection-overlay')).not.toBeNull()
    fireEvent.pointerDown(grid, { pointerId: 11, pointerType: 'touch', clientX: 15, clientY: 5 })
    expect(container.querySelector('.selection-overlay')).toBeNull()
    expect(grid).toHaveAttribute('data-multi-pointer-blocked', 'true')
    fireEvent.pointerUp(grid, { pointerId: 11, pointerType: 'touch', clientX: 15, clientY: 5 })
    fireEvent.pointerUp(grid, { pointerId: 10, pointerType: 'touch', clientX: 5, clientY: 5 })
    expect(onSelectionEnd).not.toHaveBeenCalled()
    expect(grid).not.toHaveAttribute('data-multi-pointer-blocked')
    fireEvent.pointerDown(grid, { pointerId: 12, pointerType: 'touch', clientX: 5, clientY: 5 })
    fireEvent.pointerUp(grid, { pointerId: 12, pointerType: 'touch', clientX: 15, clientY: 5 })
    expect(onSelectionEnd).toHaveBeenCalledWith({ start: { row: 0, column: 0 }, end: { row: 0, column: 1 } }, 10)
  })

  it('clamps movement but never submits when the captured pointer ends outside the board', () => {
    const onSelectionEnd = vi.fn()
    const { container } = render(<GameBoard board={board} onSelectionEnd={onSelectionEnd} />)
    const grid = within(container).getByRole('grid')
    vi.spyOn(grid, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100, toJSON: () => ({}) })
    fireEvent.pointerDown(grid, { pointerId: 20, pointerType: 'touch', clientX: 5, clientY: 5 })
    fireEvent.pointerMove(grid, { pointerId: 20, pointerType: 'touch', clientX: 260, clientY: 5 })
    fireEvent.pointerUp(grid, { pointerId: 20, pointerType: 'touch', clientX: 260, clientY: 5 })
    expect(onSelectionEnd).not.toHaveBeenCalled()
    expect(container.querySelector('.selection-overlay')).toBeNull()
  })
})

describe('automatic no-move recovery', () => {
  it('dispatches one free system reshuffle and hides the manual reshuffle control', async () => {
    const dispatch = vi.fn<(action: GameAction) => void>()
    render(gameScreen({ ...playingGame, board: [[4, 4]] }, dispatch))
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith({ type: 'reshuffle' }))
    expect(dispatch.mock.calls.filter(([action]) => action.type === 'reshuffle')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: /免費重排|無法重排/ })).toBeNull()
    expect(screen.getByText('偵測到無解，正在自動重排')).toBeInTheDocument()
  })

  it('does not auto-refresh a board with fewer than two remaining fruit', async () => {
    const dispatch = vi.fn<(action: GameAction) => void>()
    render(gameScreen({ ...playingGame, board: [[4, null]] }, dispatch))
    await Promise.resolve()
    expect(dispatch.mock.calls.some(([action]) => action.type === 'reshuffle')).toBe(false)
    expect(screen.getByText('剩餘水果不足以組成矩形')).toBeInTheDocument()
  })
})

describe('playable mode HUD', () => {
  it('shows the active mode and its hint allowance', () => {
    render(gameScreen({ ...playingGame, mode: 'hard', secondsLeft: 90 }))
    expect(screen.getByText('困難 · HARD')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '提示 1/1' })).toBeInTheDocument()
  })
})
