// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LengthSenseGame from './LengthSenseGame'
import { readAppStorage } from '../../shared/storage/appStorage'

const settings = { soundEnabled: false, reducedMotion: false, effectIntensity: 'full' } as const
beforeEach(() => { localStorage.clear(); vi.spyOn(Math, 'random').mockReturnValue(.5) })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

function remember() {
  fireEvent.click(screen.getByRole('button', { name: /開始長度挑戰/ }))
  expect(screen.getByLabelText('要記住的目標線段')).toBeInTheDocument()
  expect(screen.queryByRole('slider')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /記住了，開始還原/ }))
  expect(screen.queryByLabelText('要記住的目標線段')).not.toBeInTheDocument()
  return screen.getByRole('slider', { name: '調整線段長度' })
}

describe('Length Sense rounds', () => {
  it('hides the reference, scores the reproduction once, overlays both lines and persists records', () => {
    const changed = vi.fn()
    const { unmount } = render(<LengthSenseGame globalSettings={settings} onProgressChange={changed} platformSettingsOpen={false} />)
    const slider = remember()
    fireEvent.change(slider, { target: { value: '5250' } })
    fireEvent.click(screen.getByRole('button', { name: /就是這個長度/ }))
    expect(screen.getByText('分毫不差的眼力！')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('0.00%')
    expect(screen.getByLabelText('長度比較')).toBeInTheDocument()
    expect(readAppStorage().games.lengthSense).toMatchObject({ highScore: 1000, lengthBestErrorBp: 0, gamesPlayed: 1 })
    fireEvent.click(screen.getByRole('button', { name: /再挑戰一次/ }))
    expect(readAppStorage().games.lengthSense.gamesPlayed).toBe(1)
    expect(screen.queryByLabelText('長度比較')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /記住了，開始還原/ }))
    fireEvent.change(screen.getByRole('slider'), { target: { value: '6000' } })
    fireEvent.click(screen.getByRole('button', { name: /就是這個長度/ }))
    expect(screen.getByRole('status')).toHaveTextContent('比目標長了')
    expect(readAppStorage().games.lengthSense).toMatchObject({ highScore: 1000, lengthBestErrorBp: 0, gamesPlayed: 2 })
    expect(changed).toHaveBeenCalledTimes(2)
    unmount()
    render(<LengthSenseGame globalSettings={settings} onProgressChange={changed} platformSettingsOpen={false} />)
    expect(screen.getByText('0.00')).toBeInTheDocument()
    expect(screen.getByText('2 次')).toBeInTheDocument()
  })

  it('supports keyboard adjustment and Enter submission without repeat submissions', () => {
    render(<LengthSenseGame globalSettings={settings} onProgressChange={vi.fn()} platformSettingsOpen={false} />)
    const slider = remember()
    fireEvent.keyDown(slider, { key: 'ArrowRight', shiftKey: true })
    expect(slider).toHaveValue('1400')
    fireEvent.keyDown(slider, { key: 'ArrowLeft', shiftKey: true })
    expect(slider).toHaveValue('1200')
    fireEvent.keyDown(slider, { key: 'Enter', repeat: true })
    expect(readAppStorage().games.lengthSense.gamesPlayed).toBe(0)
    fireEvent.keyDown(slider, { key: 'Enter' })
    expect(screen.getByRole('status')).toHaveTextContent('比目標短了')
    expect(readAppStorage().games.lengthSense.gamesPlayed).toBe(1)
  })

  it('cancels observations and drawings on settings, Escape and backgrounding', () => {
    render(<LengthSenseGame globalSettings={settings} onProgressChange={vi.fn()} platformSettingsOpen={false} />)
    remember()
    fireEvent.keyDown(window, { code: 'Escape' })
    expect(screen.getByRole('status')).toHaveTextContent('這局已取消')
    fireEvent.click(screen.getByRole('button', { name: /開始長度挑戰/ }))
    act(() => window.dispatchEvent(new Event('orchard-arcade:settings-open')))
    expect(screen.getByRole('button', { name: /開始長度挑戰/ })).toBeInTheDocument()
    remember()
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    fireEvent(document, new Event('visibilitychange'))
    expect(screen.queryByRole('slider')).toBeNull()
    expect(readAppStorage().games.lengthSense.gamesPlayed).toBe(0)
  })
})
