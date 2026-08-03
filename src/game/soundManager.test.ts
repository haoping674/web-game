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

  it('fades each harvest tone to silence before stopping its oscillator', () => {
    const gainNode = () => ({ gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), cancelScheduledValues: vi.fn(), setTargetAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() })
    const masterGain = gainNode()
    const firstToneGain = gainNode()
    const secondToneGain = gainNode()
    const firstOscillator = { frequency: { setValueAtTime: vi.fn() }, connect: vi.fn(), start: vi.fn(), stop: vi.fn() }
    const secondOscillator = { frequency: { setValueAtTime: vi.fn() }, connect: vi.fn(), start: vi.fn(), stop: vi.fn() }
    const audioContext = {
      currentTime: 2,
      state: 'running',
      destination: {},
      createGain: vi.fn().mockReturnValueOnce(masterGain).mockReturnValueOnce(firstToneGain).mockReturnValueOnce(secondToneGain),
      createOscillator: vi.fn().mockReturnValueOnce(firstOscillator).mockReturnValueOnce(secondOscillator),
    }
    const AudioContextMock = vi.fn(function AudioContextMock() { return audioContext })
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: AudioContextMock })

    playComboSound({ enabled: true, volume: 0.5, combo: 1, lowStimulus: false })

    expect(firstToneGain.gain.exponentialRampToValueAtTime).toHaveBeenLastCalledWith(0.0001, 2.16)
    expect(secondToneGain.gain.exponentialRampToValueAtTime).toHaveBeenLastCalledWith(0.0001, 2.205)
    expect(firstOscillator.stop).toHaveBeenCalledWith(2.17)
    expect(secondOscillator.stop).toHaveBeenCalledWith(2.215)
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
