// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useGamePauseShortcut } from './useGamePauseShortcut'

function Harness({ isPlaying, onPause }: { isPlaying: boolean; onPause: () => void }) {
  useGamePauseShortcut({ isPlaying, onPause })
  return <><div data-testid="board-target" tabIndex={0} /><input aria-label="settings input" /></>
}

afterEach(cleanup)

describe('useGamePauseShortcut', () => {
  it('pauses a playing game with Escape from the game surface', () => {
    const onPause = vi.fn()
    const { getByTestId } = render(<Harness isPlaying onPause={onPause} />)
    fireEvent.keyDown(getByTestId('board-target'), { key: 'Escape' })
    expect(onPause).toHaveBeenCalledOnce()
  })

  it('ignores repeats, modifiers, editable controls, and non-playing states', () => {
    const onPause = vi.fn()
    const { getByLabelText, getByTestId, rerender } = render(<Harness isPlaying onPause={onPause} />)
    fireEvent.keyDown(getByTestId('board-target'), { key: 'Escape', repeat: true })
    fireEvent.keyDown(getByTestId('board-target'), { key: 'Escape', ctrlKey: true })
    fireEvent.keyDown(getByLabelText('settings input'), { key: 'Escape' })
    rerender(<Harness isPlaying={false} onPause={onPause} />)
    fireEvent.keyDown(getByTestId('board-target'), { key: 'Escape' })
    expect(onPause).not.toHaveBeenCalled()
  })
})
