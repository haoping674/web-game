// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { playComboSound, triggerHaptic } from './soundManager'

const originalAudioContext = Object.getOwnPropertyDescriptor(window, 'AudioContext')
const originalVibrate = Object.getOwnPropertyDescriptor(navigator, 'vibrate')

afterEach(() => {
  vi.restoreAllMocks()
  if (originalAudioContext) Object.defineProperty(window, 'AudioContext', originalAudioContext)
  else Reflect.deleteProperty(window, 'AudioContext')
  if (originalVibrate) Object.defineProperty(navigator, 'vibrate', originalVibrate)
  else Reflect.deleteProperty(navigator, 'vibrate')
})

describe('sound and haptic resilience', () => {
  it('does not create an audio context while sound is disabled', () => {
    const AudioContextMock = vi.fn()
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: AudioContextMock })
    playComboSound({ enabled: false, volume: 0.5, combo: 3, lowStimulus: false })
    expect(AudioContextMock).not.toHaveBeenCalled()
  })

  it('never interrupts play when AudioContext construction fails', () => {
    const AudioContextMock = vi.fn(function AudioContextMock() { throw new Error('denied') })
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: AudioContextMock })
    expect(() => playComboSound({ enabled: true, volume: 0.5, combo: 3, lowStimulus: false })).not.toThrow()
    expect(AudioContextMock).toHaveBeenCalledOnce()
  })

  it('suppresses vibration when disabled or in low-stimulation mode', () => {
    const vibrate = vi.fn(() => true)
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: vibrate })
    triggerHaptic(false, 10, false)
    triggerHaptic(true, 10, true)
    expect(vibrate).not.toHaveBeenCalled()
    triggerHaptic(true, 10, false)
    expect(vibrate).toHaveBeenCalledWith([12, 22, 16])
  })
})
