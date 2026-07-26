type Voice = {
  oscillators: OscillatorNode[]
  gain: GainNode
  timer: number
}

type AudioContextConstructor = new () => AudioContext

export class ColorLinksAudio {
  private context: AudioContext | null = null
  private voices = new Set<Voice>()

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null
    try {
      const audioWindow = window as typeof window & { webkitAudioContext?: AudioContextConstructor }
      const Context = window.AudioContext ?? audioWindow.webkitAudioContext
      if (!Context) return null
      this.context ??= new Context()
      if (this.context.state === 'suspended' && document.visibilityState !== 'hidden') {
        void this.context.resume().catch(() => undefined)
      }
      return this.context
    } catch {
      return null
    }
  }

  private trimVoices(): void {
    while (this.voices.size >= 6) {
      const oldest = this.voices.values().next().value as Voice | undefined
      if (!oldest) break
      this.stopVoice(oldest)
    }
  }

  private stopVoice(voice: Voice): void {
    window.clearTimeout(voice.timer)
    const now = this.context?.currentTime ?? 0
    try {
      voice.gain.gain.cancelScheduledValues(now)
      voice.gain.gain.setTargetAtTime(0.0001, now, 0.012)
      voice.oscillators.forEach((oscillator) => {
        try {
          oscillator.stop(now + 0.05)
        } catch {
          // The oscillator may already be stopped.
        }
      })
      voice.gain.disconnect()
    } catch {
      // A browser can detach nodes while a page is backgrounded.
    }
    this.voices.delete(voice)
  }

  private play(frequencies: readonly number[], volume: number, duration: number, type: OscillatorType): void {
    const context = this.ensureContext()
    if (!context || document.visibilityState === 'hidden') return
    this.trimVoices()
    const now = context.currentTime
    const gain = context.createGain()
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, Math.min(1, volume) * 0.055), now + 0.012)
    gain.gain.setTargetAtTime(0.0001, now + duration * 0.45, 0.04)
    gain.connect(context.destination)
    const oscillators = frequencies.map((frequency, index) => {
      const oscillator = context.createOscillator()
      oscillator.type = type
      oscillator.frequency.setValueAtTime(frequency, now + index * 0.025)
      oscillator.connect(gain)
      oscillator.start(now + index * 0.025)
      oscillator.stop(now + duration + index * 0.025)
      return oscillator
    })
    const voice: Voice = {
      gain,
      oscillators,
      timer: window.setTimeout(() => {
        this.voices.delete(voice)
        try {
          gain.disconnect()
        } catch {
          // Already disconnected.
        }
      }, (duration + frequencies.length * 0.025 + 0.1) * 1_000),
    }
    this.voices.add(voice)
  }

  playMatch(enabled: boolean, volume: number, directions: number, groups: number): void {
    if (!enabled) return
    const harmony = groups > 1 ? [392, 523.25, 659.25] : directions >= 3 ? [392, 493.88, 587.33] : [392, 523.25]
    this.play(harmony, volume, directions >= 3 ? 0.2 : 0.15, 'triangle')
  }

  playInvalid(enabled: boolean, volume: number): void {
    if (!enabled) return
    this.play([164.81, 146.83], volume * 0.55, 0.1, 'sine')
  }

  suspend(): void {
    this.voices.forEach((voice) => this.stopVoice(voice))
    if (this.context?.state === 'running') void this.context.suspend().catch(() => undefined)
  }

  dispose(): void {
    this.voices.forEach((voice) => this.stopVoice(voice))
    const context = this.context
    this.context = null
    if (context && context.state !== 'closed') void context.close().catch(() => undefined)
  }
}
