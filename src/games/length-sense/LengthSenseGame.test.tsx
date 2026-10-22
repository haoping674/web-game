// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LengthSenseGame from './LengthSenseGame'
import { readAppStorage } from '../../shared/storage/appStorage'

const settings = { soundEnabled: false, reducedMotion: false, effectIntensity: 'full' } as const
let now = 0
let frameId = 0
const frames = new Map<number, FrameRequestCallback>()
beforeEach(() => {
  localStorage.clear()
  now = 0
  frames.clear()
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
  vi.stubGlobal('PointerEvent', class extends MouseEvent {
    pointerId: number
    isPrimary: boolean
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init)
      this.pointerId = init.pointerId ?? 1
      this.isPrimary = init.isPrimary ?? true
    }
  })
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

function tick(time: number) {
  now = time
  const pending = [...frames.values()]
  frames.clear()
  act(() => pending.forEach((callback) => callback(time)))
}
const holdButton = () => screen.getByRole('button', { name: '按住讓線變長' })

describe('Length Sense hold and release', () => {
  it('shows a random target before holding and preannounces the next target after release', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(.3)
    render(<LengthSenseGame globalSettings={settings} onProgressChange={vi.fn()} platformSettingsOpen={false} />)
    fireEvent.click(screen.getByRole('button', { name: '隨機公分目標' }))
    expect(document.querySelector('.sense-random-target')).toHaveTextContent('本局目標 2.2 公分')
    const button = holdButton()
    fireEvent.keyDown(button, { code: 'Space' })
    expect(screen.getByRole('button', { name: '隨機公分目標' })).toBeDisabled()
    random.mockReturnValue(.8)
    now = 1833.333333
    fireEvent.keyUp(button, { code: 'Space' })
    expect(screen.getByLabelText('長度比較')).toHaveTextContent('目標 2.20 cm')
    expect(screen.getByRole('status')).toHaveTextContent('2.20cm')
    expect(document.querySelector('.sense-random-target')).toHaveTextContent('下一局目標 4.2 公分')
    fireEvent.keyDown(button, { code: 'Space' })
    now += 3500
    fireEvent.keyUp(button, { code: 'Space' })
    expect(screen.getByLabelText('長度比較')).toHaveTextContent('目標 4.20 cm')
    expect(screen.getByRole('status')).toHaveTextContent('4.20cm')
    expect(readAppStorage().games.lengthSense).toMatchObject({ highScore: 1000, gamesPlayed: 2, lengthBestErrorBp: 0 })
    fireEvent.click(screen.getByRole('button', { name: '5 公分挑戰' }))
    expect(document.querySelector('.sense-random-target')).toBeNull()
    expect(screen.getByRole('button', { name: '5 公分挑戰' })).toHaveAttribute('aria-pressed', 'true')
  })
  it('shows target centimeters first, grows while held and judges the release timestamp once', () => {
    const changed = vi.fn()
    render(<LengthSenseGame globalSettings={settings} onProgressChange={changed} platformSettingsOpen={false} />)
    expect(screen.getByRole('button', { name: '3 公分挑戰' })).toHaveAttribute('aria-pressed', 'true')
    const button = holdButton()
    fireEvent.pointerDown(button, { button: 0, pointerId: 1 })
    expect(screen.getByRole('button', { name: '1 公分挑戰' })).toBeDisabled()
    tick(1000)
    expect(screen.getByLabelText('持續變長的線段').style.width).toBe(`${1.2 * 96 / 2.54}px`)
    expect(screen.getByRole('status')).not.toHaveTextContent('1.20')
    now = 2500 // Release after the last rendered frame: still exactly 3 cm.
    fireEvent.pointerUp(button, { pointerId: 1 })
    fireEvent.pointerUp(button, { pointerId: 1 })
    expect(screen.getByRole('status')).toHaveTextContent('3.00cm')
    expect(screen.getByRole('status')).toHaveTextContent('0.00cm')
    expect(screen.getByText('分毫不差的眼力！')).toBeInTheDocument()
    expect(screen.getByLabelText('長度比較')).toBeInTheDocument()
    expect(readAppStorage().games.lengthSense).toMatchObject({ gamesPlayed: 1, highScore: 1000, lengthBestErrorBp: 0 })
    expect(changed).toHaveBeenCalledTimes(1)
  })

  it('holds Space or Enter, ignores key repeats and unrelated releases, and can replay', () => {
    render(<LengthSenseGame globalSettings={settings} onProgressChange={vi.fn()} platformSettingsOpen={false} />)
    fireEvent.click(screen.getByRole('button', { name: '1 公分挑戰' }))
    const button = holdButton()
    fireEvent.keyDown(button, { code: 'Space' })
    now = 500
    fireEvent.keyDown(button, { code: 'Space', repeat: true })
    fireEvent.keyUp(button, { code: 'Enter' })
    expect(screen.getByRole('button', { name: '放開結算' })).toBeInTheDocument()
    now = 1000
    fireEvent.keyUp(button, { code: 'Space' })
    expect(screen.getByRole('status')).toHaveTextContent('1.20cm')
    expect(screen.getByRole('status')).toHaveTextContent('比目標長了')
    fireEvent.keyDown(button, { code: 'Enter' })
    now = 1750
    fireEvent.keyUp(button, { code: 'Enter' })
    expect(screen.getByRole('status')).toHaveTextContent('0.90cm')
    expect(screen.getByRole('status')).toHaveTextContent('比目標短了')
    expect(readAppStorage().games.lengthSense.gamesPlayed).toBe(2)
  })

  it('cancels interrupted holds without recording or settling on a late release', () => {
    render(<LengthSenseGame globalSettings={settings} onProgressChange={vi.fn()} platformSettingsOpen={false} />)
    const button = holdButton()
    for (const interrupt of [
      () => fireEvent.pointerCancel(button),
      () => fireEvent.lostPointerCapture(button),
      () => fireEvent.blur(button),
      () => fireEvent.keyDown(window, { code: 'Escape' }),
      () => window.dispatchEvent(new Event('orchard-arcade:settings-open')),
    ]) {
      fireEvent.pointerDown(button, { button: 0 })
      act(interrupt)
      now += 500
      fireEvent.pointerUp(button)
      expect(screen.getByRole('status')).toHaveTextContent('這局已取消')
    }
    fireEvent.pointerDown(button, { button: 0 })
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    fireEvent(document, new Event('visibilitychange'))
    expect(readAppStorage().games.lengthSense.gamesPlayed).toBe(0)
  })

  it('ignores secondary pointers and auto-settles at the maximum once', () => {
    render(<LengthSenseGame globalSettings={settings} onProgressChange={vi.fn()} platformSettingsOpen={false} />)
    const button = holdButton()
    fireEvent.pointerDown(button, { button: 2 })
    fireEvent.pointerDown(button, { button: 0, isPrimary: false, pointerId: 2 })
    expect(screen.queryByRole('button', { name: '放開結算' })).toBeNull()
    fireEvent.pointerDown(button, { button: 0, pointerId: 1 })
    fireEvent.pointerUp(button, { pointerId: 2 })
    expect(screen.getByRole('button', { name: '放開結算' })).toBeInTheDocument()
    tick(10000)
    expect(screen.getByText('線段已達上限，自動結算。')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('8.00cm')
    fireEvent.pointerUp(button, { pointerId: 1 })
    expect(readAppStorage().games.lengthSense.gamesPlayed).toBe(1)
  })
})
