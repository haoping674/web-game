// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LengthSenseGame from './LengthSenseGame'
import { readAppStorage } from '../../shared/storage/appStorage'
import { PX_PER_CM } from './model'

const settings = { soundEnabled: false, reducedMotion: false, effectIntensity: 'full' } as const
const slider = () => screen.getByRole('slider', { name: '調整線段長度' })
const confirm = () => screen.getByRole('button', { name: '確認這個長度' })
const setup = (changed = vi.fn()) => render(<LengthSenseGame globalSettings={settings} onProgressChange={changed} platformSettingsOpen={false} />)

beforeEach(() => {
  localStorage.clear()
  vi.spyOn(Math, 'random').mockReturnValue(.25)
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

describe('Length Sense adjust and confirm', () => {
  it('keeps length static while time passes and records only an explicit confirmation once', () => {
    vi.useFakeTimers()
    const changed = vi.fn()
    setup(changed)
    const initial = (slider() as HTMLInputElement).value
    act(() => vi.advanceTimersByTime(10000))
    expect(slider()).toHaveValue(initial)
    fireEvent.pointerDown(slider(), { button: 0, pointerId: 1 })
    fireEvent.change(slider(), { target: { value: '3' } })
    expect(confirm()).toBeDisabled()
    fireEvent.pointerUp(slider(), { pointerId: 1 })
    expect(readAppStorage().games.lengthSense.gamesPlayed).toBe(0)
    expect(screen.queryByLabelText('長度比較')).toBeNull()
    expect(screen.getByRole('status')).not.toHaveTextContent('3.00')
    const submit = confirm()
    fireEvent.click(submit)
    fireEvent.click(submit) // Replaying starts a round; it never records a second result.
    expect(readAppStorage().games.lengthSense).toMatchObject({ gamesPlayed: 1, highScore: 1000, lengthBestErrorBp: 0, scoreRule: 'drag-centimeters' })
    expect(changed).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('allows repeated adjustment in both directions and reveals the final line comparison', () => {
    setup()
    fireEvent.change(slider(), { target: { value: '5' } })
    fireEvent.change(slider(), { target: { value: '2.5' } })
    expect(screen.getByLabelText('待確認的線段').style.width).toBe(`${2.5 * PX_PER_CM}px`)
    expect(slider()).toHaveAttribute('aria-valuetext', '長度保密，確認後揭曉')
    fireEvent.click(confirm())
    expect(screen.getByLabelText('長度比較')).toHaveTextContent('目標 3.00 cm')
    expect(screen.getByLabelText('長度比較')).toHaveTextContent('你的 2.50 cm')
    expect(screen.getByRole('status')).toHaveTextContent('比目標短了')
    expect(screen.getByRole('status')).toHaveTextContent('0.50cm')
    expect(screen.queryByRole('slider')).toBeNull()
  })

  it('shows random targets before adjustment and preannounces the next target after confirmation', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(.3)
    setup()
    fireEvent.click(screen.getByRole('button', { name: '隨機公分目標' }))
    expect(document.querySelector('.sense-random-target')).toHaveTextContent('本局目標 2.2 公分')
    fireEvent.change(slider(), { target: { value: '2.2' } })
    random.mockReturnValue(.8)
    fireEvent.click(confirm())
    expect(screen.getByLabelText('長度比較')).toHaveTextContent('目標 2.20 cm')
    expect(document.querySelector('.sense-random-target')).toHaveTextContent('下一局目標 4.2 公分')
    fireEvent.click(screen.getByRole('button', { name: '再挑戰一次' }))
    fireEvent.change(slider(), { target: { value: '4.2' } })
    fireEvent.click(confirm())
    expect(screen.getByLabelText('長度比較')).toHaveTextContent('目標 4.20 cm')
    expect(readAppStorage().games.lengthSense).toMatchObject({ gamesPlayed: 2, highScore: 1000 })
    fireEvent.click(screen.getByRole('button', { name: '5 公分挑戰' }))
    expect(document.querySelector('.sense-random-target')).toBeNull()
    expect(screen.getByRole('button', { name: '5 公分挑戰' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('starts each replay at a new random length and never auto-submits at the limit', () => {
    setup()
    const initial = (slider() as HTMLInputElement).value
    fireEvent.change(slider(), { target: { value: '8' } })
    expect(readAppStorage().games.lengthSense.gamesPlayed).toBe(0)
    fireEvent.click(confirm())
    vi.spyOn(Math, 'random').mockReturnValue(.8)
    fireEvent.click(screen.getByRole('button', { name: '再挑戰一次' }))
    expect((slider() as HTMLInputElement).value).not.toBe(initial)
    expect(readAppStorage().games.lengthSense.gamesPlayed).toBe(1)
  })

  it.each(['pointer', 'escape', 'blur', 'settings', 'hidden'] as const)('cancels on %s without recording a late confirmation', (interruption) => {
    setup()
    const input = slider()
    const submit = confirm()
    fireEvent.change(input, { target: { value: '3' } })
    if (interruption === 'pointer') fireEvent.pointerCancel(input)
    if (interruption === 'escape') fireEvent.keyDown(input, { code: 'Escape' })
    if (interruption === 'blur') fireEvent(window, new Event('blur'))
    if (interruption === 'settings') act(() => window.dispatchEvent(new Event('orchard-arcade:settings-open')))
    if (interruption === 'hidden') {
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
      fireEvent(document, new Event('visibilitychange'))
    }
    fireEvent.pointerUp(input)
    fireEvent.click(submit)
    expect(readAppStorage().games.lengthSense.gamesPlayed).toBe(0)
  })

  it('cancels and disables input when settings are opened through props', () => {
    const view = setup()
    fireEvent.change(slider(), { target: { value: '3' } })
    view.rerender(<LengthSenseGame globalSettings={settings} onProgressChange={vi.fn()} platformSettingsOpen />)
    expect(screen.getByRole('button', { name: '重新開始' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('這局已取消')
    expect(readAppStorage().games.lengthSense.gamesPlayed).toBe(0)
  })

  it('fits the rail and cancels an unsubmitted round on workspace resize', () => {
    let resized: ResizeObserverCallback = () => {}
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 240 } as DOMRect)
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeObserverCallback) { resized = callback }
      observe() {}
      disconnect() {}
    })
    setup()
    expect(Number(slider().getAttribute('max'))).toBeLessThanOrEqual(240 / PX_PER_CM)
    fireEvent.change(slider(), { target: { value: '3' } })
    act(() => resized([{ contentRect: { width: 210 } } as ResizeObserverEntry], {} as ResizeObserver))
    expect(screen.getByRole('status')).toHaveTextContent('這局已取消')
    expect(readAppStorage().games.lengthSense.gamesPlayed).toBe(0)
    fireEvent.click(screen.getByRole('button', { name: '重新開始' }))
    expect(Number(slider().getAttribute('max'))).toBeLessThanOrEqual(210 / PX_PER_CM)
  })
})
