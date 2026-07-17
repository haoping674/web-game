import { getComboTier, isComboMilestone } from './comboTier'

type AudioContextConstructor = new () => AudioContext
type ActiveVoice = { gain: GainNode; oscillators: OscillatorNode[]; timer: number | null }
type SoundOptions = { enabled: boolean; volume: number; combo: number; lowStimulus: boolean }
export type ComboSoundProfile = {
  frequencies: readonly number[]
  offsets: readonly number[]
  duration: number
  waveform: OscillatorType
  milestone: boolean
}

type HighTierPattern = {
  intervals: readonly number[]
  offsets: readonly number[]
  duration: number
}

const MAX_ACTIVE_OSCILLATORS = 8
const HIGH_TIER_PATTERNS = [
  { intervals: [0, 4, 7], offsets: [0, 0.04, 0.08], duration: 0.2 },
  { intervals: [0, 7, 12], offsets: [0, 0.035, 0.09], duration: 0.21 },
  { intervals: [0, 3, 7, 12], offsets: [0, 0.03, 0.065, 0.11], duration: 0.22 },
  { intervals: [0, 4, 9, 12], offsets: [0, 0.045, 0.075, 0.12], duration: 0.22 },
] as const satisfies readonly HighTierPattern[]
const activeVoices = new Set<ActiveVoice>()
let context: AudioContext | null = null
let compressor: DynamicsCompressorNode | null = null
let flowVoice: ActiveVoice | null = null
let visibilityListenerInstalled = false

const semitone = (base: number, steps: number) => base * 2 ** (steps / 12)

export function getComboSoundProfile(combo: number, lowStimulus = false): ComboSoundProfile {
  if (lowStimulus) return { frequencies: [523.25, 659.25], offsets: [0, 0.045], duration: 0.16, waveform: 'sine', milestone: false }

  const normalizedCombo = Math.max(0, Math.floor(combo))
  const tier = getComboTier(normalizedCombo)
  const milestone = isComboMilestone(normalizedCombo)
  const cappedStep = normalizedCombo >= 10
    ? Math.min(12, 7 + (normalizedCombo - 10) * 2)
    : Math.min(normalizedCombo - 1, 6)
  const root = semitone(523.25, Math.max(0, cappedStep))
  if (milestone) {
    const upper = normalizedCombo >= 20 ? 12 : normalizedCombo >= 10 ? 9 : 7
    return { frequencies: [root, semitone(root, 4), semitone(root, upper)], offsets: [0, 0.055, 0.13], duration: 0.3, waveform: 'triangle', milestone: true }
  }
  if (tier === 'legendary' || tier === 'orchard') {
    const pattern = HIGH_TIER_PATTERNS[Math.max(0, normalizedCombo - 13) % HIGH_TIER_PATTERNS.length]!
    return { frequencies: pattern.intervals.map((interval) => semitone(root, interval)), offsets: pattern.offsets, duration: pattern.duration, waveform: 'triangle', milestone: false }
  }
  if (tier === 'charged') {
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

function fadeVoice(voice: ActiveVoice, fadeSeconds = 0.045): void {
  if (!context) return
  const now = context.currentTime
  try {
    if (voice.timer !== null) window.clearTimeout(voice.timer)
    voice.gain.gain.cancelScheduledValues(now)
    voice.gain.gain.setTargetAtTime(0.0001, now, Math.max(0.012, fadeSeconds / 4))
    voice.oscillators.forEach((oscillator) => {
      try { oscillator.stop(now + fadeSeconds + 0.03) } catch { /* already stopped */ }
    })
  } catch { /* audio may have been detached by the browser */ }
  activeVoices.delete(voice)
  if (flowVoice === voice) flowVoice = null
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
      stopComboAudio()
      void context.suspend().catch(() => undefined)
    }
  })
}

function ensureContext(): AudioContext | null {
  try {
    const AudioContextClass = getAudioContextConstructor()
    if (!AudioContextClass) return null
    context ??= new AudioContextClass()
    if (!compressor) {
      compressor = context.createDynamicsCompressor()
      compressor.threshold.setValueAtTime(-18, context.currentTime)
      compressor.knee.setValueAtTime(16, context.currentTime)
      compressor.ratio.setValueAtTime(10, context.currentTime)
      compressor.attack.setValueAtTime(0.004, context.currentTime)
      compressor.release.setValueAtTime(0.12, context.currentTime)
      compressor.connect(context.destination)
    }
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
  gain.connect(compressor ?? audioContext.destination)

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
  const voice: ActiveVoice = { gain, oscillators, timer: null }
  activeVoices.add(voice)
  voice.timer = window.setTimeout(() => {
    activeVoices.delete(voice)
    try { gain.disconnect() } catch { /* detached by the browser */ }
  }, (lastOffset + profile.duration + 0.08) * 1_000)
}

function startFlowLayer(volume: number): void {
  if (flowVoice || typeof document === 'undefined' || document.visibilityState === 'hidden') return
  const audioContext = ensureContext()
  if (!audioContext) return
  const gain = audioContext.createGain()
  const oscillators = [audioContext.createOscillator(), audioContext.createOscillator()]
  gain.gain.setValueAtTime(0.0001, audioContext.currentTime)
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, Math.min(1, volume) * 0.018), audioContext.currentTime + 0.16)
  oscillators[0]!.type = 'sine'
  oscillators[1]!.type = 'triangle'
  oscillators[0]!.frequency.setValueAtTime(130.81, audioContext.currentTime)
  oscillators[1]!.frequency.setValueAtTime(196, audioContext.currentTime)
  oscillators.forEach((oscillator) => { oscillator.connect(gain); oscillator.start() })
  gain.connect(compressor ?? audioContext.destination)
  flowVoice = { gain, oscillators, timer: null }
  activeVoices.add(flowVoice)
}

export function playComboSound({ enabled, volume, combo, lowStimulus }: SoundOptions): void {
  if (!enabled || typeof window === 'undefined') return
  try {
    playProfile(getComboSoundProfile(combo, lowStimulus), volume)
    if (combo >= 10 && !lowStimulus) startFlowLayer(volume)
  } catch { /* audio feedback must never break play */ }
}

export function playComboBreakSound(enabled: boolean, volume = 0.45): void {
  if (!enabled || typeof window === 'undefined') return
  try {
    playProfile({ frequencies: [293.66, 220], offsets: [0, 0.06], duration: 0.14, waveform: 'sine', milestone: false }, volume * 0.38)
  } catch { /* audio feedback must never break play */ }
}

export function stopComboAudio(): void {
  for (const voice of activeVoices) fadeVoice(voice, voice === flowVoice ? 0.45 : 0.045)
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
