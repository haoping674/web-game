const clips = ['shake', 'thread', 'hiss', 'burst', 'spray', 'splash'] as const
type Clip = typeof clips[number]

export function makeColaAudio() {
  let context: AudioContext | undefined
  let output: GainNode | undefined
  let enabled = true
  let loading = false
  let closed = false
  const sounds = new Map<Clip, AudioBuffer>()
  const playing = new Set<AudioBufferSourceNode>()

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

  function play(name: Clip, level: number, pitch = 1, pan = 0): void {
    const buffer = sounds.get(name)
    if (!enabled || !context || !output || context.state !== 'running' || !buffer || playing.size >= 13) return
    const start = context.currentTime
    const source = context.createBufferSource()
    const volume = context.createGain()
    const position = context.createStereoPanner()
    const duration = buffer.duration / pitch
    source.buffer = buffer
    source.playbackRate.value = pitch
    position.pan.value = pan
    volume.gain.setValueAtTime(0, start)
    volume.gain.linearRampToValueAtTime(level, start + Math.min(.012, duration / 5))
    volume.gain.setValueAtTime(level, start + duration * .72)
    volume.gain.linearRampToValueAtTime(0, start + duration)
    source.connect(volume).connect(position).connect(output)
    source.onended = () => { playing.delete(source); source.disconnect(); volume.disconnect(); position.disconnect() }
    playing.add(source)
    source.start()
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
    stop,
    setEnabled(value: boolean) { enabled = value; if (!value) stop() },
    dispose() { closed = true; stop(); if (context) void context.close().catch(() => {}) },
  }
}
