// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SecondSenseGame from './SecondSenseGame'
import { readAppStorage } from '../../shared/storage/appStorage'

const settings = { soundEnabled: false, reducedMotion: false, effectIntensity: 'full' } as const
let now = 0
beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  now = 0
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers() })

describe('Second Sense rounds', () => {
  it('locks the target, judges a precise stop once and retains per-target bests across remounts', () => {
    const onProgressChange = vi.fn()
    const { unmount } = render(<SecondSenseGame globalSettings={settings} onProgressChange={onProgressChange} platformSettingsOpen={false} />)
    fireEvent.click(screen.getByRole('button', { name: '開始計時' }))
    expect(screen.getByRole('button', { name: '1 秒挑戰' })).toBeDisabled()
    now = 3020
    fireEvent.click(screen.getByRole('button', { name: '停止計時' }))
    expect(screen.getByRole('status')).toHaveTextContent('3.020')
    expect(screen.getByText('完美瞬間！')).toBeInTheDocument()
    expect(readAppStorage().games.secondSense).toMatchObject({ gamesPlayed: 1, highScore: 980, timingBestMs: { 3: 20 } })
    fireEvent.click(screen.getByRole('button', { name: '再挑戰一次' }))
    now = 6100
    fireEvent.click(screen.getByRole('button', { name: '停止計時' }))
    expect(readAppStorage().games.secondSense.timingBestMs?.[3]).toBe(20)
    expect(onProgressChange).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole('button', { name: '1 秒挑戰' }))
    fireEvent.click(screen.getByRole('button', { name: '開始計時' }))
    now = 7100
    fireEvent.click(screen.getByRole('button', { name: '停止計時' }))
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
