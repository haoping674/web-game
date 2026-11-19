type Recording = 'slide' | 'draw' | 'fibers' | 'handling' | 'paper-desk' | 'box-drop' | 'box-tap'
type Pickup = 'box' | 'soft-pack' | 'paper' | 'loose-paper'
type Take = { offset: number; energy: number }
type Sample = { buffer: AudioBuffer; takes: Take[]; peak: number; last: Take | undefined }
type Motion = {
  feed: number; tension: number; film: number
  x: number; z: number
  loose: number; onDesk: boolean
  boxSlide: number; boxX: number; boxZ: number
}

const primary: Recording[] = ['handling', 'slide', 'draw', 'fibers']
const secondary: Recording[] = ['paper-desk', 'box-drop', 'box-tap']
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))
const vary = (center: number, spread: number) => center + (Math.random() * 2 - 1) * spread

function analyze(buffer: AudioBuffer, name: Recording): Sample {
  const audio = buffer.getChannelData(0)
  const width = Math.max(1, Math.floor(buffer.sampleRate * 0.012))
  const energy = new Float32Array(Math.ceil(audio.length / width))
  let peak = 0
  for (let start = 0, frame = 0; start < audio.length; start += width, frame++) {
    let sum = 0
    const end = Math.min(start + width, audio.length)
    for (let i = start; i < end; i += 2) sum += audio[i] * audio[i]
    energy[frame] = Math.sqrt(2 * sum / (end - start))
    peak = Math.max(peak, energy[frame])
  }

  const takes: Take[] = []
  const impacts = name === 'box-tap' || name === 'box-drop' || name === 'draw'
  for (let i = 1; i < energy.length - 5; i++) {
    const level = energy[i]
    if (level < peak * 0.13 || level < energy[i - 1] || level <= energy[i + 1]) continue
    const offset = Math.max(0, (i - (impacts ? 2 : 1)) * width / buffer.sampleRate)
    if (offset - (takes.at(-1)?.offset ?? -1) < (impacts ? 0.16 : 0.068)) continue
    takes.push({ offset, energy: level })
  }
  if (!takes.length) takes.push({ offset: 0, energy: peak })
  return { buffer, takes, peak, last: undefined }
}

export function createTissueAudio() {
  const samples = new Map<Recording, Sample>()
  const sources = new Set<AudioBufferSourceNode>()
  const requests = new Map<Recording, Promise<ArrayBuffer | null>>()
  const decoding = new Set<Recording>()
  const load = new AbortController()
  let context: AudioContext | undefined
  let master: GainNode | undefined
  let reflection: GainNode | undefined
  let enabled = false
  let paused = true
  let alive = true
  let unlocking = false
  let nextSlip = 0
  let nextFiber = 0
  let nextLoose = 0
  let nextBoxSlide = 0
  let nextBrush = 0
  let nextLand = 0
  let nextImpact = 0
  let pendingPickup: { kind: Pickup; x: number; z: number; expires: number } | undefined

  function request(name: Recording) {
    let pending = requests.get(name)
    if (!pending) {
      pending = fetch(`${import.meta.env.BASE_URL}tissue-roll/${name}.mp3`, { signal: load.signal })
        .then((response) => response.ok ? response.arrayBuffer() : null).catch(() => null)
      requests.set(name, pending)
    }
    return pending
  }

  function decode(name: Recording, audio: AudioContext) {
    if (decoding.has(name) || samples.has(name)) return
    decoding.add(name)
    void request(name).then(async (data) => {
      if (!data || !alive) return
      const buffer = await audio.decodeAudioData(data)
      if (alive) samples.set(name, analyze(buffer, name))
      flushPickup()
    }).catch(() => undefined)
  }

  function unlock() {
    if (!alive || !enabled || paused || unlocking || !('AudioContext' in window)) return
    if (!context) {
      const audio = new AudioContext({ latencyHint: 'interactive' })
      context = audio
      master = audio.createGain()
      master.gain.value = 0.78
      const limiter = audio.createDynamicsCompressor()
      limiter.threshold.value = -20
      limiter.ratio.value = 4
      limiter.attack.value = 0.003
      limiter.release.value = 0.09
      master.connect(limiter).connect(audio.destination)

      reflection = audio.createGain()
      reflection.gain.value = 0.10
      const delay = audio.createDelay(0.08)
      delay.delayTime.value = 0.025
      const wall = audio.createBiquadFilter()
      wall.type = 'lowpass'
      wall.frequency.value = 2600
      reflection.connect(delay).connect(wall).connect(master)
      for (const name of [...primary, ...secondary]) decode(name, audio)
    }
    if (context.state === 'running') return
    unlocking = true
    void context.resume().then(flushPickup).catch(() => undefined).finally(() => { unlocking = false })
  }

  function play(name: Recording, level: number, x: number, z: number, rate: number, seconds: number, cutoff: number, delay = 0, force = 0.5) {
    const audio = context
    const sample = samples.get(name)
    if (!alive || !enabled || paused || !audio || audio.state !== 'running' || !master || !sample || sources.size >= 12) return false
    const { buffer, takes, peak } = sample
    let take = takes[Math.floor(Math.random() * takes.length)]
    for (let tries = 0; tries < 3; tries++) {
      const candidate = takes[Math.floor(Math.random() * takes.length)]
      if (candidate !== sample.last && (take === sample.last || Math.abs(candidate.energy / Math.max(peak, 0.0001) - force)
        < Math.abs(take.energy / Math.max(peak, 0.0001) - force))) take = candidate
    }
    if (take === sample.last && takes.length > 1) take = takes[(takes.indexOf(take) + 1) % takes.length]
    sample.last = take
    const duration = Math.min(buffer.duration - take.offset, seconds)
    const source = audio.createBufferSource()
    const envelope = audio.createGain()
    const pan = audio.createStereoPanner()
    const tone = audio.createBiquadFilter()
    const now = audio.currentTime + delay
    const playTime = duration / rate
    const distance = clamp(0.88 + z * 0.16, 0.56, 1)
    const gain = level * distance * clamp(0.13 / Math.max(peak, 0.025), 0.60, 2.8)
    tone.type = 'lowpass'
    tone.frequency.value = cutoff * (0.76 + distance * 0.24)
    source.buffer = buffer
    source.playbackRate.value = rate
    pan.pan.value = Math.tanh(x * 0.72) * 0.63
    envelope.gain.setValueAtTime(0, now)
    envelope.gain.linearRampToValueAtTime(gain, now + Math.min(0.005, playTime * 0.16))
    envelope.gain.setValueAtTime(gain, now + playTime * 0.53)
    envelope.gain.linearRampToValueAtTime(0, now + playTime)
    source.connect(tone).connect(envelope).connect(pan).connect(master)
    if (reflection) pan.connect(reflection)
    sources.add(source)
    source.onended = () => {
      sources.delete(source)
      source.disconnect()
      tone.disconnect()
      envelope.disconnect()
      pan.disconnect()
    }
    source.start(now, take.offset, duration)
    return true
  }

  function pickUp(kind: Pickup, x: number, z: number) {
    if (kind === 'box') return play('box-tap', 0.15, x, z, vary(1.08, 0.08), 0.082, 4500, 0, 0.24)
    if (kind === 'soft-pack') return play('handling', 0.21, x, z, vary(1.13, 0.05), 0.108, 6600, 0, 0.38)
    return play('handling', kind === 'loose-paper' ? 0.15 : 0.10, x, z, vary(0.96, 0.10), 0.074, 5300, 0, 0.25)
  }

  function flushPickup() {
    const pickup = pendingPickup
    if (!pickup) return
    if (performance.now() > pickup.expires || pickUp(pickup.kind, pickup.x, pickup.z)) pendingPickup = undefined
  }

  return {
    unlock,
    configure(sound: boolean, stopped: boolean) {
      const changed = enabled !== sound || paused !== stopped
      enabled = sound
      paused = stopped
      if (!sound || stopped) pendingPickup = undefined
      if (!changed) return
      if (sound && !stopped && 'AudioContext' in window) for (const name of primary) void request(name)
      if (context && master) master.gain.setTargetAtTime(sound && !stopped ? 0.78 : 0, context.currentTime, 0.014)
    },
    grab(kind: Pickup, x: number, z: number) {
      if (context && enabled && !paused && !pickUp(kind, x, z)) {
        pendingPickup = { kind, x, z, expires: performance.now() + 240 }
      }
    },
    release(x: number, z: number) {
      play('handling', 0.085, x, z, vary(0.86, 0.07), 0.067, 4300, 0, 0.2)
    },
    tick(motion: Motion) {
      if (!enabled || paused || context?.state !== 'running') return
      const { feed, tension, film, x, z, loose, onDesk, boxSlide, boxX, boxZ } = motion
      const now = context.currentTime
      const pace = clamp(feed / 5, 0, 1)
      if (feed > 0.075 && now >= nextSlip) {
        nextSlip = now + vary(0.132 - pace * 0.068, 0.009)
        play('slide', 0.066 + Math.sqrt(pace) * 0.20, x, z, vary(0.82 + pace * 0.38, 0.055),
          0.125 - pace * 0.025, 3800 + pace * 4400, 0, 0.28 + pace * 0.50)
      }
      const strain = clamp(tension * 0.19 + Math.abs(film) * 12, 0, 1)
      if (feed > 0.11 && strain > 0.13 && now >= nextFiber) {
        nextFiber = now + vary(0.24 - strain * 0.12, 0.026)
        play('fibers', 0.030 + strain * 0.10, x, z, vary(0.91 + strain * 0.19, 0.095),
          0.084, 4500 + strain * 4600, 0, 0.40 + strain * 0.49)
      }
      if (loose > 0.32 && now >= nextLoose) {
        const speed = clamp(loose / 5, 0, 1)
        nextLoose = now + vary(0.19 - speed * 0.09, 0.016)
        play(onDesk ? 'paper-desk' : 'handling', 0.043 + speed * 0.12, x, z, vary(0.88 + speed * 0.23, 0.07),
          0.102, onDesk ? 4400 : 6100, 0, 0.25 + speed * 0.57)
      }
      if (boxSlide > 0.24 && now >= nextBoxSlide) {
        const speed = clamp(boxSlide / 3.5, 0, 1)
        nextBoxSlide = now + vary(0.19 - speed * 0.06, 0.013)
        play('paper-desk', 0.04 + speed * 0.08, boxX, boxZ, vary(0.56 + speed * 0.11, 0.04), 0.136, 2200)
      }
    },
    draw(strength: number, x: number, z: number) {
      const force = clamp(strength / 6, 0, 1)
      play('draw', 0.25 + force * 0.21, x, z, vary(0.88 + force * 0.24, 0.06), 0.20, 5900 + force * 2900, 0, 0.32 + force * 0.65)
      play('fibers', 0.050 + force * 0.11, x, z, vary(0.88 + force * 0.25, 0.08), 0.09, 7900, 0.012, force)
      play('handling', 0.044 + force * 0.084, x, z, vary(0.86 + force * 0.14, 0.09), 0.14, 5100, 0.048, 0.37)
    },
    brush(strength: number, x: number, z: number) {
      if (!context || context.currentTime < nextBrush) return
      if (play('handling', 0.05 + strength * 0.095, x, z, vary(0.84, 0.09), 0.085, 5200, 0, 0.38)) {
        nextBrush = context.currentTime + 0.115
      }
    },
    land(strength: number, x: number, z: number) {
      if (!context || context.currentTime < nextLand) return
      const force = clamp(strength / 6, 0, 1)
      if (play('paper-desk', 0.078 + force * 0.115, x, z, vary(0.83 + force * 0.16, 0.09),
        0.13, 3450 + force * 1300, 0, 0.24 + force * 0.48)) nextLand = context.currentTime + 0.14
    },
    clear(count: number, x: number, z: number) {
      if (count <= 0) return
      const pile = Math.min(1, (count - 1) / 4)
      play('paper-desk', 0.15 + pile * 0.11, x, z, vary(0.92 - pile * 0.09, 0.06), 0.15, 4800, 0, 0.47)
      play('handling', 0.07 + pile * 0.11, x + 0.22, z, vary(1.04, 0.08), 0.11, 5900, 0.043, 0.44)
    },
    impact(strength: number, x: number, z: number, surface: 'table' | 'edge', soft = false) {
      if (!context || context.currentTime < nextImpact) return
      const force = clamp(strength / 7, 0, 1)
      if (soft) {
        if (play('paper-desk', 0.10 + force * 0.20, x, z, vary(0.66, 0.06), 0.139, 3000, 0, 0.39 + force * 0.25)) {
          nextImpact = context.currentTime + 0.10
          play('handling', 0.06 + force * 0.10, x, z, vary(0.88, 0.06), 0.097, 5700, 0.018, 0.39)
        }
        return
      }
      if (!play(surface === 'table' ? 'box-drop' : 'box-tap', 0.11 + force * 0.34, x, z,
        vary(1.03 - force * 0.12, 0.09), 0.17, surface === 'table' ? 4900 : 6100, 0, 0.23 + force * 0.72)) return
      nextImpact = context.currentTime + 0.086
      if (force > 0.40) play('box-tap', 0.045 + force * 0.075, x, z, vary(1.12, 0.10), 0.085, 5200, 0.019, 0.3)
    },
    dispose() {
      alive = false
      load.abort()
      for (const source of sources) source.stop()
      if (context) void context.close().catch(() => undefined)
    },
  }
}
