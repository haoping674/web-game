type AudioContextConstructor = new () => AudioContext
type ActiveVoice = { gain: GainNode; oscillators: OscillatorNode[]; toneGains: GainNode[]; timer: number | null }
type SoundOptions = { enabled: boolean; volume: number; combo: number; lowStimulus: boolean }
export type ComboSoundProfile = {
  frequencies: readonly number[]
  offsets: readonly number[]
  duration: number
  waveform: OscillatorType
  milestone: boolean
}

const MAX_ACTIVE_OSCILLATORS = 8
const HARVEST_SOUND = {
  frequencies: [523.25, 659.25],
  offsets: [0, 0.045],
  duration: 0.16,
  waveform: 'sine',
  milestone: false,
} as const satisfies ComboSoundProfile
const activeVoices = new Set<ActiveVoice>()
let context: AudioContext | null = null
let visibilityListenerInstalled = false

export function getComboSoundProfile(_combo: number, _lowStimulus = false): ComboSoundProfile {
  return HARVEST_SOUND
}

function getAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === 'undefined') return null
  const safariWindow = window as typeof window & { webkitAudioContext?: AudioContextConstructor }
  return window.AudioContext ?? safariWindow.webkitAudioContext ?? null
}

function disconnectVoice(voice: ActiveVoice): void {
  try { voice.gain.disconnect() } catch { /* already disconnected */ }
  voice.toneGains.forEach((toneGain) => {
    try { toneGain.disconnect() } catch { /* already disconnected */ }
  })
}

function fadeVoice(voice: ActiveVoice, fadeSeconds = 0.045): void {
  if (!context) return
  const now = context.currentTime
  try {
    if (voice.timer !== null) window.clearTimeout(voice.timer)
    voice.timer = null
    voice.gain.gain.cancelScheduledValues(now)
    voice.gain.gain.setTargetAtTime(0.0001, now, Math.max(0.012, fadeSeconds / 4))
    voice.oscillators.forEach((oscillator) => {
      try { oscillator.stop(now + fadeSeconds + 0.03) } catch { /* already stopped */ }
    })
    voice.timer = window.setTimeout(() => disconnectVoice(voice), (fadeSeconds + 0.08) * 1_000)
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
  const toneGains: GainNode[] = []
  const peak = Math.max(0.0001, Math.min(1, volume) * (profile.milestone ? 0.09 : 0.065))
  gain.gain.setValueAtTime(peak, now)
  gain.connect(audioContext.destination)

  profile.frequencies.forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator()
    const offset = profile.offsets[index] ?? 0
    const toneGain = audioContext.createGain()
    const startTime = now + offset
    const endTime = startTime + profile.duration
    const attackSeconds = Math.min(0.012, profile.duration / 3)
    const releaseSeconds = Math.min(0.04, profile.duration / 3)
    const sustainUntil = Math.max(startTime + attackSeconds, endTime - releaseSeconds)
    oscillator.type = profile.waveform
    oscillator.frequency.setValueAtTime(frequency, startTime)
    toneGain.gain.setValueAtTime(0.0001, startTime)
    toneGain.gain.exponentialRampToValueAtTime(1, startTime + attackSeconds)
    toneGain.gain.setValueAtTime(1, sustainUntil)
    toneGain.gain.exponentialRampToValueAtTime(0.0001, endTime)
    oscillator.connect(toneGain)
    toneGain.connect(gain)
    oscillator.start(startTime)
    // Never cut the waveform while its gain is audible: that click is especially
    // noticeable as a low buzz on small mobile speakers.
    oscillator.stop(endTime + 0.01)
    oscillators.push(oscillator)
    toneGains.push(toneGain)
  })

  const lastOffset = Math.max(...profile.offsets)
  const voice: ActiveVoice = { gain, oscillators, toneGains, timer: null }
  activeVoices.add(voice)
  voice.timer = window.setTimeout(() => {
    activeVoices.delete(voice)
    disconnectVoice(voice)
  }, (lastOffset + profile.duration + 0.1) * 1_000)
}

export function playComboSound({ enabled, volume, combo, lowStimulus }: SoundOptions): void {
  if (!enabled || typeof window === 'undefined') return
  try {
    playProfile(getComboSoundProfile(combo, lowStimulus), volume)
  } catch { /* audio feedback must never break play */ }
}

export function playComboBreakSound(enabled: boolean, volume = 0.45): void {
  if (!enabled || typeof window === 'undefined') return
  try {
    playProfile({ frequencies: [293.66, 220], offsets: [0, 0.06], duration: 0.14, waveform: 'sine', milestone: false }, volume * 0.38)
  } catch { /* audio feedback must never break play */ }
}

export function stopComboAudio(): void {
  for (const voice of activeVoices) fadeVoice(voice)
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
