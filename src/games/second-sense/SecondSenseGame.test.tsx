// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SecondSenseGame from './SecondSenseGame'
import { readAppStorage } from '../../shared/storage/appStorage'

const settings = { soundEnabled: false, reducedMotion: false, effectIntensity: 'full' } as const

vi.mock('../../share/useShareResult', () => ({ useShareResult: () => ({ preparePreview: vi.fn(), previewUrl: null, isGenerating: false, status: null, hasSystemShare: false, hasImageShare: false, copy: vi.fn(), download: vi.fn(), systemShare: vi.fn() }) }))

function finishRound(nextTarget?: RegExp) {
  fireEvent.click(screen.getByRole('button', { name: '停止計時' }))
  expect(screen.getByRole('dialog', { name: '本局結算' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '分享成績' })).toBeInTheDocument()
  if (nextTarget) expect(within(screen.getByRole('dialog')).getByText(nextTarget)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '關閉對話框' }))
}

let now = 0
beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  now = 0
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers() })

describe('Second Sense rounds', () => {
  it('opens a result after each attempt, replays from it, and does not label ties as new records', () => {
    render(<SecondSenseGame globalSettings={settings} onProgressChange={vi.fn()} platformSettingsOpen={false} />)
    fireEvent.click(screen.getByRole('button', { name: '開始計時' }))
    now = 3020
    fireEvent.click(screen.getByRole('button', { name: '停止計時' }))
    expect(within(screen.getByRole('dialog')).getByText('↗ 個人新紀錄')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '再玩一次' }))
    now = 6040
    fireEvent.click(screen.getByRole('button', { name: '停止計時' }))
    expect(within(screen.getByRole('dialog')).queryByText('↗ 個人新紀錄')).toBeNull()
    expect(readAppStorage().games.secondSense.gamesPlayed).toBe(2)
  })
  it('announces random targets before each round, locks them during play, and preserves the finished target', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(.3)
    render(<SecondSenseGame globalSettings={settings} onProgressChange={vi.fn()} platformSettingsOpen={false} />)
    fireEvent.click(screen.getByRole('button', { name: '隨機秒數目標' }))
    expect(document.querySelector('.sense-random-target')).toHaveTextContent('本局目標 2.2 秒')
    expect(screen.getByRole('button', { name: '3 秒挑戰' })).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(screen.getByRole('button', { name: '開始計時' }))
    expect(screen.getByRole('button', { name: '隨機秒數目標' })).toBeDisabled()
    random.mockReturnValue(.8)
    now = 2220
    finishRound(/下一局目標 4.2 秒/)
    expect(screen.getByRole('status')).toHaveTextContent('本局目標 2.2 秒')
    expect(screen.getByRole('status')).toHaveTextContent('0.020')
    expect(document.querySelector('.sense-random-target')).toHaveTextContent('下一局目標 4.2 秒')
    expect(readAppStorage().games.secondSense).toMatchObject({ timingRandomBestMs: 20, timingBestMs: {}, gamesPlayed: 1 })
    fireEvent.click(screen.getByRole('button', { name: '再挑戰一次' }))
    now = 6420
    finishRound()
    expect(readAppStorage().games.secondSense.timingRandomBestMs).toBe(0)
    fireEvent.click(screen.getByRole('button', { name: '1 秒挑戰' }))
    expect(screen.getByRole('button', { name: '隨機秒數目標' })).toHaveAttribute('aria-pressed', 'false')
    expect(document.querySelector('.sense-random-target')).toBeNull()
  })
  it('locks the target, judges a precise stop once and retains per-target bests across remounts', () => {
    const onProgressChange = vi.fn()
    const { unmount } = render(<SecondSenseGame globalSettings={settings} onProgressChange={onProgressChange} platformSettingsOpen={false} />)
    fireEvent.click(screen.getByRole('button', { name: '開始計時' }))
    expect(screen.getByRole('button', { name: '1 秒挑戰' })).toBeDisabled()
    now = 3020
    finishRound()
    expect(screen.getByRole('status')).toHaveTextContent('3.020')
    expect(screen.getByText('完美瞬間！')).toBeInTheDocument()
    expect(readAppStorage().games.secondSense).toMatchObject({ gamesPlayed: 1, highScore: 980, timingBestMs: { 3: 20 } })
    fireEvent.click(screen.getByRole('button', { name: '再挑戰一次' }))
    now = 6100
    finishRound()
    expect(readAppStorage().games.secondSense.timingBestMs?.[3]).toBe(20)
    expect(onProgressChange).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole('button', { name: '1 秒挑戰' }))
    fireEvent.click(screen.getByRole('button', { name: '開始計時' }))
    now = 7100
    finishRound()
    expect(readAppStorage().games.secondSense.timingBestMs).toEqual({ 1: 0, 3: 20 })
    unmount()
    render(<SecondSenseGame globalSettings={settings} onProgressChange={onProgressChange} platformSettingsOpen={false} />)
    expect(screen.getByText('±0.000 s')).toBeInTheDocument()
    expect(screen.getByText('±0.020 s')).toBeInTheDocument()
  })

  it('supports Space without held-key repeats and cancels with Escape without recording', () => {
    render(<SecondSenseGame globalSettings={settings} onProgressChange={vi.fn()} platformSettingsOpen={false} />)
    fireEvent.keyDown(document.body, { code: 'Space' })
    now = 100
    fireEvent.keyDown(document.body, { code: 'Space', repeat: true })
    expect(screen.getByRole('button', { name: '停止計時' })).toBeInTheDocument()
    fireEvent.keyDown(document.body, { code: 'Escape' })
    expect(readAppStorage().games.secondSense.gamesPlayed).toBe(0)
    expect(screen.getByRole('status')).toHaveTextContent('這局已取消')
    fireEvent.keyDown(document.body, { code: 'Space' })
    now = 3100
    fireEvent.keyDown(document.body, { code: 'Space' })
    expect(readAppStorage().games.secondSense).toMatchObject({ gamesPlayed: 1, timingBestMs: { 3: 0 } })
  })

  it('cancels on backgrounding, settings, and timeout without a scored result', () => {
    render(<SecondSenseGame globalSettings={settings} onProgressChange={vi.fn()} platformSettingsOpen={false} />)
    fireEvent.click(screen.getByRole('button', { name: '開始計時' }))
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    fireEvent(document, new Event('visibilitychange'))
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    expect(screen.getByRole('button', { name: '開始計時' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '開始計時' }))
    act(() => { window.dispatchEvent(new Event('orchard-arcade:settings-open')) })
    expect(screen.getByRole('button', { name: '開始計時' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '開始計時' }))
    act(() => { vi.advanceTimersByTime(30_000) })
    expect(screen.getByRole('status')).toHaveTextContent('超過 30 秒')
    expect(readAppStorage().games.secondSense.gamesPlayed).toBe(0)
  })
})
