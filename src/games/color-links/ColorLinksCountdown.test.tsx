// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { markGameTutorialSeen, type GlobalSettings } from '../../shared/storage/appStorage'
import ColorLinksGame from './ColorLinksGame'

vi.mock('./board', async (importOriginal) => ({
  ...await importOriginal<typeof import('./board')>(),
  generateBoard: () => [[null, 'coral', null], ['blue', null, 'blue'], [null, 'coral', null]],
}))
vi.mock('../../shared/leaderboard/LeaderboardPanel', () => ({ LeaderboardPanel: () => null }))

const settings: GlobalSettings = { soundEnabled: false, reducedMotion: false, effectIntensity: 'full' }

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  localStorage.clear()
  markGameTutorialSeen('colorLinks')
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function startGame(globalSettings = settings) {
  const view = render(<ColorLinksGame globalSettings={globalSettings} onProgressChange={vi.fn()} platformSettingsOpen={false} />)
  fireEvent.click(screen.getByRole('button', { name: /開始串聯/ }))
  return view
}

function elapse(seconds: number) {
  // Flush each render so its next authoritative wake-up can be scheduled.
  for (let second = 0; second < seconds; second += 1) act(() => vi.advanceTimersByTime(1_000))
}

describe('Color Links countdown integration', () => {
  it('follows the game clock and penalty jumps, pauses, resumes, expires, and resets', () => {
    const { container } = startGame()
    const frame = () => container.querySelector('.color-board-frame')
    expect(frame()).toHaveAttribute('data-countdown-phase', 'idle')
    elapse(20)
    expect(frame()).toHaveAttribute('data-countdown-phase', 'warning')
    elapse(4)
    // Invalid corner skips from six seconds straight to four.
    fireEvent.click(screen.getByRole('gridcell', { name: '第 1 列第 1 欄，空格' }))
    expect(frame()).toHaveAttribute('data-countdown-phase', 'critical')
    expect(container.querySelector('.board-countdown-badge')).toHaveTextContent('剩 4 秒')
    expect(container.querySelector('.timer-countdown')).toHaveTextContent('00:04')
    const announcement = container.querySelector('.board-countdown-announcement')?.textContent
    elapse(1)
    expect(container.querySelector('.board-countdown-announcement')).toHaveTextContent(announcement!)
    fireEvent.click(screen.getByRole('button', { name: '暫停遊戲' }))
    expect(container.querySelector('.board-countdown-ring')).toBeNull()
    elapse(10)
    fireEvent.click(screen.getByRole('button', { name: '繼續遊戲' }))
    expect(container.querySelector('.board-countdown-badge')).toHaveTextContent('剩 3 秒')
    elapse(3)
    expect(screen.getByRole('dialog', { name: 'Color Links 遊戲結果' })).toBeInTheDocument()
    expect(frame()).toHaveAttribute('data-countdown-phase', 'idle')
    fireEvent.click(screen.getByRole('button', { name: '再玩一次' }))
    expect(frame()).toHaveAttribute('data-countdown-phase', 'idle')
    expect(container.querySelector('.timer-countdown')).toHaveTextContent('00:30')
  })

  it('accepts a clearing move in the final second and removes the warning on early completion', () => {
    const { container } = startGame()
    elapse(29)
    expect(container.querySelector('.board-countdown-badge')).toHaveTextContent('剩 1 秒')
    fireEvent.click(screen.getByRole('gridcell', { name: '第 2 列第 2 欄，空格' }))
    expect(screen.getByRole('heading', { name: '全數色塊已清空' })).toBeInTheDocument()
    expect(container.querySelector('.color-board-frame')).toHaveAttribute('data-countdown-phase', 'idle')
  })

  it.each([
    { ...settings, reducedMotion: true },
    { ...settings, effectIntensity: 'reduced' as const },
    { ...settings, effectIntensity: 'off' as const },
  ])('retains the static reminder with settings %j', (globalSettings) => {
    const { container } = startGame(globalSettings)
    elapse(25)
    expect(container.querySelector('.color-board-frame')).toHaveAttribute('data-countdown-phase', 'critical')
    expect(container.querySelector('.board-countdown-ring')).toHaveAttribute('data-animated', 'false')
  })
})
