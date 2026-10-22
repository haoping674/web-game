// One context per mounted game; all tones are short and release before stopping.
export class TimingAudio {
  private context: AudioContext | null = null

  play(quality: number): void {
    try {
      const Constructor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Constructor) return
      this.context ??= new Constructor()
      const context = this.context
      void context.resume().catch(() => undefined)
      const notes = quality < 0 ? [330] : quality === 0 ? [220, 277] : [523, 659, 784, 1047].slice(0, quality + 1)
      notes.forEach((frequency, index) => {
        const oscillator = context.createOscillator()
        const gain = context.createGain()
        const start = context.currentTime + index * .065
        oscillator.type = 'sine'
        oscillator.frequency.value = frequency
        gain.gain.setValueAtTime(.0001, start)
        gain.gain.exponentialRampToValueAtTime(.07, start + .012)
        gain.gain.exponentialRampToValueAtTime(.0001, start + .25)
        oscillator.connect(gain)
        gain.connect(context.destination)
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
        oscillator.start(start)
        oscillator.stop(start + .28)
      })
    } catch { /* Audio support is optional; the round always remains playable. */ }
  }

  stop(): void {
    if (this.context) void this.context.close().catch(() => undefined)
    this.context = null
  }
}
