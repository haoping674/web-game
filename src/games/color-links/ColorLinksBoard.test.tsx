// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { findMatchesAtCell } from './board'
import { ColorLinksBoard, type ColorLinksEffect } from './ColorLinksBoard'
import type { ColorLinksBoard as Board } from './types'

const board: Board = [
  [null, 'coral', null],
  ['blue', null, 'blue'],
  [null, 'coral', null],
]

const effect: ColorLinksEffect = {
  id: 1,
  origin: { row: 1, column: 1 },
  matches: findMatchesAtCell(board, { row: 1, column: 1 }),
  points: 5,
}

afterEach(cleanup)

describe('Color Links board accessibility and effects', () => {
  it('allows only empty cells to submit a move', () => {
    const onSelect = vi.fn()
    render(<ColorLinksBoard board={board} onSelect={onSelect} />)
    const filled = screen.getByRole('gridcell', { name: /第 1 列第 2 欄，珊瑚色塊/ })
    const empty = screen.getByRole('gridcell', { name: /第 2 列第 2 欄，空格/ })
    expect(filled).toBeDisabled()
    expect(empty).toBeEnabled()
    fireEvent.click(filled)
    fireEvent.click(empty)
    expect(onSelect).toHaveBeenCalledOnce()
    expect(onSelect).toHaveBeenCalledWith({ row: 1, column: 1 })
  })

  it('renders pointer-transparent lines and particles in each removed tile color', () => {
    const { container } = render(<ColorLinksBoard board={board} effect={effect} />)
    const layer = screen.getByTestId('color-effect-layer')
    expect(layer).toHaveStyle({ pointerEvents: 'none' })
    expect(container.querySelectorAll('.color-link-line')).toHaveLength(4)
    expect(container.querySelectorAll('.color-particle-cluster')).toHaveLength(4)
    const coralTarget = container.querySelector<HTMLElement>('.color-effect-target')
    expect(coralTarget?.style.getPropertyValue('--effect-color')).toBe('#df715f')
  })

  it('removes particle clusters when reduced motion is requested', () => {
    const { container } = render(<ColorLinksBoard board={board} effect={effect} reducedMotion />)
    expect(screen.getByTestId('color-effect-layer')).toHaveClass('is-reduced')
    expect(container.querySelector('.color-particle-cluster')).toBeNull()
  })

  it('uses a portrait visual grid and repositions effects on narrow portrait screens', () => {
    const removeEventListener = vi.fn()
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener,
    }))

    const portraitEffect: ColorLinksEffect = {
      ...effect,
      origin: { row: 0, column: 1 },
    }
    const { container, unmount } = render(<ColorLinksBoard board={board} effect={portraitEffect} />)
    expect(container.querySelector('.color-board-frame')).toHaveAttribute('data-layout', 'portrait')
    expect(screen.getByRole('grid')).toHaveClass('is-portrait')
    expect(container.querySelector('.color-board-row')).toHaveStyle({ '--color-row-index': '1' })
    const layer = screen.getByTestId('color-effect-layer')
    expect(Number.parseFloat(layer.style.getPropertyValue('--origin-x'))).toBeCloseTo(100 / 6)
    expect(Number.parseFloat(layer.style.getPropertyValue('--origin-y'))).toBe(50)

    unmount()
    expect(removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
    vi.unstubAllGlobals()
  })
})
