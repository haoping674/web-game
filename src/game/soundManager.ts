let context: AudioContext | null = null

export function playHarvestSound(enabled: boolean, volume = 0.45): void {
  if (!enabled || typeof window === 'undefined') return
  context ??= new AudioContext()
  const now = context.currentTime
  ;[523.25, 659.25].forEach((frequency, index) => {
    const oscillator = context?.createOscillator()
    const gain = context?.createGain()
    if (!oscillator || !gain || !context) return
    oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(0.0001, now + index * 0.04)
    gain.gain.exponentialRampToValueAtTime(0.08 * volume, now + index * 0.04 + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.04 + 0.16)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start(now + index * 0.04)
    oscillator.stop(now + index * 0.04 + 0.17)
  })
}

export function playInvalidSound(enabled: boolean, volume = 0.45): void {
  if (!enabled || typeof window === 'undefined') return
  context ??= new AudioContext()
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  const now = context.currentTime
  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(170, now)
  oscillator.frequency.exponentialRampToValueAtTime(130, now + 0.09)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.035 * volume, now + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1)
  oscillator.connect(gain).connect(context.destination)
  oscillator.start(now)
  oscillator.stop(now + 0.11)
}
