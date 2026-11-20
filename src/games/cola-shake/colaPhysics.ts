export const MAX_DISTANCE_CM = 575
export const JET_ANGLE = Math.PI / 4.6
export const NOZZLE_HEIGHT = 0.36
export const JET_DURATION = 0.9
const GRAVITY = 9.81
const DRAG = 0.85
const OPEN_TIME = 0.92
export const SEAL_BREAK = 0.33

export type Phase = 'shake' | 'opening' | 'spray' | 'result'
export type Packet = { x: number; y: number; vx: number; vy: number; age: number }

export function jetVelocity(pressure: number, emissionTime: number): number {
  const surge = Math.min(1, 0.68 + 2.3 * emissionTime)
  return (1.8 + 8.9 * pressure) * surge * Math.exp(-1.88 * Math.max(0, emissionTime - 0.15))
}

export function makePacket(pressure: number, emissionTime: number): Packet {
  const speed = jetVelocity(pressure, emissionTime)
  return { x: 0, y: NOZZLE_HEIGHT, vx: speed * Math.cos(JET_ANGLE), vy: speed * Math.sin(JET_ANGLE), age: 0 }
}

export function movePacket(packet: Packet, dt: number): number | undefined {
  const resistance = Math.exp(-DRAG * dt)
  packet.age += dt
  packet.vx *= resistance
  packet.vy = (packet.vy + GRAVITY / DRAG) * resistance - GRAVITY / DRAG
  const nextY = packet.y + packet.vy * dt
  const dx = packet.vx * dt
  if (nextY <= 0) {
    packet.x += dx * packet.y / (packet.y - nextY)
    packet.y = 0
    return packet.x
  }
  packet.x += dx
  packet.y = nextY
}

export class ColaRound {
  phase: Phase = 'shake'
  pressure = 0
  opening = 0
  age = 0
  elapsed = 0
  swing = 0
  slosh = 0
  foam = 0
  distance = 0
  launchPressure = 0
  finishedAt = 0
  particles: Packet[] = []
  lastImpact = 0
  impacts = 0
  private lastBeat = -Infinity
  private direction = 0
  private emitted = 0

  shake(direction: number): boolean {
    if (this.phase !== 'shake' || direction === this.direction) return false
    const interval = this.elapsed - this.lastBeat
    if (interval < 0.11) return false
    this.direction = direction
    this.lastBeat = this.elapsed
    const rhythm = Number.isFinite(interval) ? Math.max(0.25, 1 - Math.abs(interval - 0.26) * 2.7) : 0.65
    this.pressure += (1 - this.pressure) * 0.185 * rhythm
    this.swing = direction
    return true
  }

  beginOpening(): void {
    if (this.phase === 'shake') this.phase = 'opening'
  }

  step(dt: number, held: boolean): void {
    this.elapsed += dt
    this.swing *= Math.exp(-dt * 7)
    this.slosh += (this.swing - this.slosh) * (1 - Math.exp(-dt * 11))
    if (this.phase === 'shake') {
      if (this.elapsed - this.lastBeat > 0.48) this.pressure = Math.max(0, this.pressure - dt * 0.14)
    } else if (this.phase === 'opening') {
      if (held) this.opening = Math.min(1, this.opening + dt / OPEN_TIME)
      if (this.opening < SEAL_BREAK) this.pressure = Math.max(0, this.pressure - dt * 0.035)
      else this.pressure *= Math.exp(-dt * (held ? 0.15 : 0.78))
      if (this.opening >= 1) {
        this.phase = 'spray'
        this.launchPressure = this.pressure
      }
    } else if (this.phase === 'spray') {
      this.age += dt
      while (this.emitted <= JET_DURATION && this.emitted < this.age) {
        this.particles.push(makePacket(this.launchPressure, this.emitted))
        this.emitted += 1 / 60
      }
      let active = 0
      for (const packet of this.particles) {
        const landing = movePacket(packet, dt)
        if (landing === undefined) {
          this.particles[active++] = packet
        } else {
          this.lastImpact = landing
          this.impacts++
          this.distance = Math.max(this.distance, Math.min(MAX_DISTANCE_CM, Math.round(landing * 100)))
        }
      }
      this.particles.length = active
      this.pressure *= Math.exp(-dt * 3)
      if (this.age > JET_DURATION && active === 0) {
        this.finishedAt = this.age
        this.phase = 'result'
      }
    } else {
      this.age += dt
    }
    const targetFoam = this.phase === 'result' ? 0 : this.pressure
    this.foam += (targetFoam - this.foam) * (1 - Math.exp(-dt * 5))
  }
}
