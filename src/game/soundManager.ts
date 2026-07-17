import { getComboTier, isComboMilestone } from './comboTier'

type AudioContextConstructor = new () => AudioContext
type ActiveVoice = { gain: GainNode; oscillators: OscillatorNode[] }
type SoundOptions = { enabled: boolean; volume: number; combo: number; lowStimulus: boolean }
export type ComboSoundProfile = {
  frequencies: readonly number[]
  offsets: readonly number[]
  duration: number
  waveform: OscillatorType
  milestone: boolean
}

const MAX_ACTIVE_OSCILLATORS = 8
const activeVoices = new Set<ActiveVoice>()
let context: AudioContext | null = null
let visibilityListenerInstalled = false

const semitone = (base: number, steps: number) => base * 2 ** (steps / 12)

export function getComboSoundProfile(combo: number, lowStimulus = false): ComboSoundProfile {
  if (lowStimulus) return { frequencies: [523.25, 659.25], offsets: [0, 0.045], duration: 0.16, waveform: 'sine', milestone: false }

  const tier = getComboTier(combo)
  const milestone = isComboMilestone(combo)
  const cappedStep = combo >= 10 ? [7, 9, 11, 12][(combo - 10) % 4]! : Math.min(combo - 1, 6)
  const root = semitone(523.25, Math.max(0, cappedStep))
  if (milestone) {
    const upper = combo >= 20 ? 12 : combo >= 10 ? 9 : 7
    return { frequencies: [root, semitone(root, 4), semitone(root, upper)], offsets: [0, 0.055, 0.13], duration: 0.3, waveform: 'triangle', milestone: true }
  }
  if (tier === 'charged' || tier === 'legendary') {
    return { frequencies: [root, semitone(root, 4), semitone(root, 7)], offsets: [0, 0.04, 0.08], duration: 0.2, waveform: 'triangle', milestone: false }
  }
  if (tier === 'rising') {
    return { frequencies: [root, semitone(root, 4)], offsets: [0, 0.045], duration: 0.18, waveform: 'sine', milestone: false }
  }
  return { frequencies: [root, semitone(root, 4)], offsets: [0, 0.045], duration: 0.16, waveform: 'sine', milestone: false }
}

function getAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === 'undefined') return null
  const safariWindow = window as typeof window & { webkitAudioContext?: AudioContextConstructor }
  return window.AudioContext ?? safariWindow.webkitAudioContext ?? null
}

function fadeVoice(voice: ActiveVoice): void {
  if (!context) return
  const now = context.currentTime
  try {
    voice.gain.gain.cancelScheduledValues(now)
    voice.gain.gain.setTargetAtTime(0.0001, now, 0.012)
    voice.oscillators.forEach((oscillator) => {
      try { oscillator.stop(now + 0.045) } catch { /* already stopped */ }
    })
  } catch { /* audio may have been detached by the browser */ }
  activeVoices.delete(voice)
}

function trimVoices(incomingOscillators: number): void {
  let activeCount = [...activeVoices].reduce((sum, voice) => sum + voice.oscillators.length, 0)
  for (const voice of activeVoices) {
    if (activeCount + incomingOscillators <= MAX_ACTIVE_OSCILLATORS) break
    activeCount -= voice.oscillators.length
    fadeVoice(voice)
  }
}

function installVisibilityHandling(): void {
  if (visibilityListenerInstalled || typeof document === 'undefined') return
  visibilityListenerInstalled = true
  document.addEventListener('visibilitychange', () => {
    if (!context) return
    if (document.visibilityState === 'hidden') {
      activeVoices.forEach(fadeVoice)
      void context.suspend().catch(() => undefined)
    }
  })
}

function ensureContext(): AudioContext | null {
  try {
    const AudioContextClass = getAudioContextConstructor()
    if (!AudioContextClass) return null
    context ??= new AudioContextClass()
    installVisibilityHandling()
    if (context.state === 'suspended' && document.visibilityState !== 'hidden') void context.resume().catch(() => undefined)
    return context
  } catch {
    return null
  }
}

function playProfile(profile: ComboSoundProfile, volume: number): void {
  const audioContext = ensureContext()
  if (!audioContext || document.visibilityState === 'hidden') return
  trimVoices(profile.frequencies.length)
  const now = audioContext.currentTime
  const gain = audioContext.createGain()
  const oscillators: OscillatorNode[] = []
  const peak = Math.max(0.0001, Math.min(1, volume) * (profile.milestone ? 0.09 : 0.065))
  gain.gain.setValueAtTime(0.0001, now)
  gain.connect(audioContext.destination)

  profile.frequencies.forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator()
    const offset = profile.offsets[index] ?? 0
    oscillator.type = profile.waveform
    oscillator.frequency.setValueAtTime(frequency, now + offset)
    oscillator.connect(gain)
    oscillator.start(now + offset)
    oscillator.stop(now + offset + profile.duration)
    oscillators.push(oscillator)
  })

  const lastOffset = Math.max(...profile.offsets)
  gain.gain.exponentialRampToValueAtTime(peak, now + 0.012)
  gain.gain.setTargetAtTime(0.0001, now + lastOffset + profile.duration * 0.45, 0.045)
  const voice = { gain, oscillators }
  activeVoices.add(voice)
  window.setTimeout(() => activeVoices.delete(voice), (lastOffset + profile.duration + 0.08) * 1_000)
}

export function playComboSound({ enabled, volume, combo, lowStimulus }: SoundOptions): void {
  if (!enabled || typeof window === 'undefined') return
  try { playProfile(getComboSoundProfile(combo, lowStimulus), volume) } catch { /* audio feedback must never break play */ }
}

export function playInvalidSound(enabled: boolean, volume = 0.45): void {
  if (!enabled || typeof window === 'undefined') return
  try {
    playProfile({ frequencies: [170, 130], offsets: [0, 0.055], duration: 0.1, waveform: 'sine', milestone: false }, volume * 0.55)
  } catch { /* audio feedback must never break play */ }
}

export function triggerHaptic(enabled: boolean, combo: number, lowStimulus: boolean): void {
  if (!enabled || lowStimulus || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
  const pattern = combo >= 10 ? [12, 22, 16] : combo >= 5 ? [14, 18, 10] : 12
  try { navigator.vibrate(pattern) } catch { /* unsupported or denied */ }
}
