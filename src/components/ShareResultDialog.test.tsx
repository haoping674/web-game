// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ResultDialog } from './ResultDialog'
import type { GameState, GameStatistics } from '../game/types'

vi.mock('../share/useShareResult', () => ({
  useShareResult: () => ({ copy: vi.fn(), download: vi.fn(), hasSystemShare: false, isGenerating: false, preparePreview: vi.fn(), previewUrl: null, status: null, systemShare: vi.fn() }),
}))

const game: GameState = { board: [], score: 12, secondsLeft: 0, status: 'finished', combo: 0, bestCombo: 3, comboDeadline: null, successfulMoves: 4, invalidMoves: 1, hintsUsed: 0 }
const statistics: GameStatistics = { highScore: 12, lastScore: 12, gamesPlayed: 1, totalCleared: 12, highestCombo: 3, totalScore: 12, bestClearsPerMinute: 6 }

describe('result sharing dialog', () => {
  afterEach(() => { document.body.innerHTML = '' })

  it('opens with the keyboard and closes with Escape', async () => {
    render(<ResultDialog game={game} statistics={statistics} onRestart={vi.fn()} onHome={vi.fn()} />)
    const share = screen.getByRole('button', { name: /分享成績/ })
    share.focus()
    fireEvent.keyDown(share, { key: 'Enter' })
    fireEvent.click(share)
    expect(document.querySelector('.share-fallback')).toBeTruthy()
    expect(screen.getByRole('dialog', { name: '分享本次成績' })).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '分享本次成績' })).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(share))
  })
})
