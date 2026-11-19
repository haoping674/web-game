type Layer = 'slide' | 'draw' | 'fibers'
const layers: Layer[] = ['slide', 'draw', 'fibers']

function findAttacks(buffer: AudioBuffer): number[] {
  const samples = buffer.getChannelData(0)
  const window = Math.floor(buffer.sampleRate * 0.016)
  const energy: number[] = []
  for (let start = 0; start + window < samples.length; start += window) {
    let sum = 0
    for (let i = start; i < start + window; i += 2) sum += samples[i] * samples[i]
    energy.push(Math.sqrt(sum / (window / 2)))
  }
  const threshold = Math.max(...energy) * 0.29
  const attacks: number[] = []
  for (let i = 1; i < energy.length - 3; i++) {
    if (energy[i] < threshold || energy[i] < energy[i + 1] || energy[i] < energy[i - 1]) continue
    const time = Math.max(0, i * window / buffer.sampleRate - 0.023)
    if (time > buffer.duration - 0.05 || time - (attacks.at(-1) ?? -1) < 0.17) continue
    attacks.push(time)
  }
  return attacks.length ? attacks : [0]
}

export function createTissueAudio() {
  const samples = new Map<Layer, { buffer: AudioBuffer; attacks: number[] }>()
  const sources = new Set<AudioBufferSourceNode>()
  const loads = new Map<Layer, Promise<ArrayBuffer | null>>()
  const load = new AbortController()
  let context: AudioContext | undefined
  let master: GainNode | undefined
  let reflection: DelayNode | undefined
  let enabled = true
  let stopped = false
  let alive = true
  let unlockPending = false
  let nextSlide = 0
  let nextFiber = 0
  let lastDraw = -1
  for (const name of layers) {
    loads.set(name, fetch(`${import.meta.env.BASE_URL}tissue-roll/${name}.mp3`, { signal: load.signal })
      .then((response) => response.ok ? response.arrayBuffer() : null).catch(() => null))
  }

  function unlock() {
    if (!alive || !enabled || unlockPending) return
    if (!context) {
      if (!('AudioContext' in window)) return
      const audio = new AudioContext({ latencyHint: 'interactive' })
      context = audio
      master = audio.createGain()
      master.gain.value = 0.65
      const compressor = audio.createDynamicsCompressor()
      master.connect(compressor).connect(audio.destination)
      reflection = audio.createDelay(0.16)
      reflection.delayTime.value = 0.036
      const room = audio.createBiquadFilter()
      room.type = 'lowpass'
      room.frequency.value = 2900
      const reflectionGain = audio.createGain()
      reflectionGain.gain.value = 0.13
      reflection.connect(room).connect(reflectionGain).connect(master)
      for (const [name, request] of loads) {
        void request.then(async (data) => {
          if (!data || !alive) return
          const buffer = await audio.decodeAudioData(data)
          if (alive) samples.set(name, { buffer, attacks: findAttacks(buffer) })
        }).catch(() => undefined)
      }
    }
    unlockPending = true
    void context.resume().catch(() => undefined).finally(() => { unlockPending = false })
  }

  function play(name: Layer, gain: number, pan: number, rate: number, seconds: number) {
    const audio = context
    const sample = samples.get(name)
    if (!enabled || stopped || !audio || audio.state !== 'running' || !master || !sample || sources.size >= 20) return
    const { buffer, attacks } = sample
    let take = Math.floor(Math.random() * attacks.length)
    if (name === 'draw' && take === lastDraw) take = (take + 1) % attacks.length
    if (name === 'draw') lastDraw = take
    const offset = attacks[take]
    const duration = Math.min(buffer.duration - offset, seconds)
    const source = audio.createBufferSource()
    const envelope = audio.createGain()
    const position = audio.createStereoPanner()
    const filter = audio.createBiquadFilter()
    const now = audio.currentTime
    filter.type = 'lowpass'
    filter.frequency.value = Math.min(8500, 1500 + rate * 3600)
    source.buffer = buffer
    source.playbackRate.value = rate
    position.pan.value = Math.max(-0.64, Math.min(0.64, pan))
    envelope.gain.setValueAtTime(0, now)
    envelope.gain.linearRampToValueAtTime(gain, now + 0.008)
    envelope.gain.setTargetAtTime(0, now + duration / rate * 0.52, 0.026)
    source.connect(filter).connect(envelope).connect(position).connect(master)
    if (reflection) position.connect(reflection)
    sources.add(source)
    source.onended = () => {
      sources.delete(source)
      source.disconnect()
      filter.disconnect()
      envelope.disconnect()
      position.disconnect()
    }
    source.start(now, offset, duration)
  }

  return {
    unlock,
    configure(sound: boolean, paused: boolean) {
      if ((stopped !== paused || enabled !== sound) && context && master) {
        master.gain.setTargetAtTime(sound && !paused ? 0.65 : 0, context.currentTime, 0.018)
      }
      enabled = sound
      stopped = paused
    },
    tick(speed: number, tension: number, pan: number) {
      if (!context) return
      const now = context.currentTime
      if (speed > 0.2 && now >= nextSlide) {
        nextSlide = now + 0.24 / (0.86 + speed * 0.8)
        play('slide', Math.min(0.36, speed * 0.11), pan, 0.79 + speed * 0.10, 0.165)
      }
      if (tension > 0.24 && now >= nextFiber) {
        nextFiber = now + 0.24 / (0.9 + tension)
        play('fibers', Math.min(0.12, tension * 0.047), pan, 0.81 + Math.random() * 0.26, 0.10)
      }
    },
    draw(strength: number, pan: number) { play('draw', Math.min(0.65, 0.26 + strength * 0.085), pan, 0.88 + Math.random() * 0.18 + strength * 0.045, 0.27) },
    dispose() {
      alive = false
      load.abort()
      for (const source of sources) source.stop()
      if (context) void context.close().catch(() => undefined)
    },
  }
}
