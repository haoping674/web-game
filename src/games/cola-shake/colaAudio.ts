const softSloshes = ['slosh-soft-a', 'slosh-soft-b'] as const
const strongSloshes = ['slosh-strong-a', 'slosh-strong-b'] as const
const clips = [...softSloshes, ...strongSloshes, 'bubbles', 'thread', 'hiss', 'burst', 'spray', 'splash'] as const
type Clip = typeof clips[number]

export function makeColaAudio() {
  let context: AudioContext | undefined
  let output: GainNode | undefined
  let enabled = true
  let loading = false
  let closed = false
  const sounds = new Map<Clip, AudioBuffer>()
  const playing = new Set<AudioBufferSourceNode>()
  let softTake = 0
  let strongTake = 0
  let bubbleOffset = 0

  function unlock(): void {
    if (!enabled || closed) return
    try {
      if (!context) {
        context = new AudioContext()
        output = context.createGain()
        output.gain.value = .84
        const limiter = context.createDynamicsCompressor()
        limiter.threshold.value = -10
        limiter.knee.value = 8
        limiter.ratio.value = 5
        limiter.attack.value = .003
        limiter.release.value = .14
        output.connect(limiter).connect(context.destination)
      }
      void context.resume().catch(() => {})
      if (loading) return
      loading = true
      const decoder = context
      void Promise.allSettled(clips.map(async name => {
        const response = await fetch(`${import.meta.env.BASE_URL}cola-shake/${name}.mp3`)
        if (!response.ok) return
        const buffer = await decoder.decodeAudioData(await response.arrayBuffer())
        if (!closed) sounds.set(name, buffer)
      }))
    } catch { /* Audio support varies by browser. */ }
  }

  function play(name: Clip, level: number, pitch = 1, pan = 0, offset = 0, sampleWindow = Infinity): void {
    const buffer = sounds.get(name)
    if (!enabled || !context || !output || context.state !== 'running' || !buffer || playing.size >= 13) return
    const sampleLength = Math.min(buffer.duration - offset, sampleWindow)
    if (sampleLength <= 0) return
    const start = context.currentTime
    const source = context.createBufferSource()
    const volume = context.createGain()
    const position = context.createStereoPanner()
    const duration = sampleLength / pitch
    source.buffer = buffer
    source.playbackRate.value = pitch
    position.pan.value = pan
    volume.gain.setValueAtTime(0, start)
    volume.gain.linearRampToValueAtTime(level, start + Math.min(name === 'bubbles' ? .045 : .012, duration / 5))
    volume.gain.setValueAtTime(level, start + duration * (name === 'bubbles' ? .4 : .72))
    volume.gain.linearRampToValueAtTime(0, start + duration)
    source.connect(volume).connect(position).connect(output)
    source.onended = () => { playing.delete(source); source.disconnect(); volume.disconnect(); position.disconnect() }
    playing.add(source)
    source.start(start, offset, sampleLength)
  }

  function shake(force: number, pressure: number, direction: number): void {
    const strength = Math.min(1, Math.max(0, force))
    const take = strength < .62 ? softSloshes[softTake++ % 2] : strongSloshes[strongTake++ % 2]
    const pan = direction * .10
    play(take, .48 + strength * .44, 1, pan)
    if (pressure > .52) {
      const fizz = (pressure - .52) / .48
      bubbleOffset = (bubbleOffset + .29) % 1.03
      play('bubbles', fizz * (.30 + strength * .24), 1, pan * .6, bubbleOffset, .27 + strength * .08)
    }
  }

  function stop(): void {
    for (const source of playing) {
      try { source.stop() } catch { /* Source may have just finished. */ }
    }
    playing.clear()
  }

  return {
    unlock,
    play,
    shake,
    stop,
    setEnabled(value: boolean) { enabled = value; if (!value) stop() },
    dispose() { closed = true; stop(); if (context) void context.close().catch(() => {}) },
  }
}
