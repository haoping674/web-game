type AudioContextConstructor = new () => AudioContext

export class NumberPathAudio {
  private context: AudioContext | null = null

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null
    try {
      const audioWindow = window as typeof window & { webkitAudioContext?: AudioContextConstructor }
      const Context = window.AudioContext ?? audioWindow.webkitAudioContext
      if (!Context) return null
      this.context ??= new Context()
      if (this.context.state === 'suspended' && document.visibilityState !== 'hidden') void this.context.resume().catch(() => undefined)
      return this.context
    } catch {
      return null
    }
  }

  private play(enabled: boolean, frequency: number, duration: number, volume: number): void {
    if (!enabled || document.visibilityState === 'hidden') return
    const context = this.getContext()
    if (!context) return
    try {
      const now = context.currentTime
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(frequency, now)
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.22, now + duration)
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(volume, now + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(now)
      oscillator.stop(now + duration + 0.02)
    } catch {
      // Audio is progressive enhancement only.
    }
  }

  playCorrect(enabled: boolean, value: number): void {
    this.play(enabled, 320 + (value % 7) * 36, 0.13, 0.035)
  }

  playInvalid(enabled: boolean): void {
    this.play(enabled, 150, 0.11, 0.024)
  }

  suspend(): void {
    if (this.context?.state === 'running') void this.context.suspend().catch(() => undefined)
  }

  dispose(): void {
    const context = this.context
    this.context = null
    if (context && context.state !== 'closed') void context.close().catch(() => undefined)
  }
}
