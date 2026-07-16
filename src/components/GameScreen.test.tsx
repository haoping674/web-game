// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { GameAction } from '../game/gameReducer'
import type { GameSettings, GameState } from '../game/types'
import { GameBoard } from './GameBoard'
import { GameScreen } from './GameScreen'

const settings: GameSettings = { soundEnabled: false, volume: 0.5, animationsEnabled: true, lowStimulus: false, showSelectionHelp: true }
const board = [[1, 9], [null, 2]]
const playingGame: GameState = { board, score: 12, secondsLeft: 42, nextTickAt: Date.now() + 1_000, status: 'playing', combo: 2, bestCombo: 3, comboDeadline: Date.now() + 2_000, successfulMoves: 1, invalidMoves: 0, hintsUsed: 0 }

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
})
