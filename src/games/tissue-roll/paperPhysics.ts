import { Vector3 } from 'three'
import { BoxMotion } from './boxMotion'

export const COLUMNS = 15
export const WIDTH = 1.94
export const PITCH = 0.112
export const SHEET_ROWS = 19
export const FLOOR = -0.78
export const BOX_LENGTH = 2.33
export const BOX_DEPTH = 1.18
export const BOX_HEIGHT = 0.73
export const SLOT_HALF_LENGTH = 0.79
export const SLOT_HALF_DEPTH = 0.155
const TOP = FLOOR + BOX_HEIGHT
const COUPLING_DISTANCE = 0.58
const EXPOSED = 0.52
const TOTAL = (SHEET_ROWS - 1) * PITCH

type Point = { position: Vector3; previous: Vector3 }
export type PaperRow = { id: number; points: Point[] }
export type Offcut = { rows: PaperRow[]; age: number }
type Grip = { point: Point; target: Vector3; offset: Vector3; piece?: Offcut }
export type PaperEvents = { draw: (strength: number, pan: number) => void; impact?: (strength: number, pan: number) => void }

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))
const node = (): Point => ({ position: new Vector3(), previous: new Vector3() })

export class PaperPhysics {
  rows: PaperRow[] = []
  upcoming: PaperRow[] = []
  offcuts: Offcut[] = []
  speed = 0
  tension = 0
  produced = 0
  grip: Grip | null = null
  readonly boxMotion = new BoxMotion()
  readonly box = this.boxMotion.pose
  readonly events: PaperEvents
  private exposed = EXPOSED
  private assistTime = 0
  private assistFast = false
  private releaseTime = 0
  private serial = 0
  private difference = new Vector3()
  private profile = new Vector3()
  private local = new Vector3()
  private load = new Vector3()
  private heldPosition = new Vector3()

  constructor(events: PaperEvents) {
    this.events = events
    this.setGuidedPaper(this.rows, this.exposed, false)
  }

  private world(x: number, y: number, z: number, out: Vector3) {
    const c = Math.cos(this.box.yaw)
    const s = Math.sin(this.box.yaw)
    return out.set(x * c + z * s + this.box.x, y + this.box.lift, -x * s + z * c + this.box.z)
  }

  private silhouette(row: number, column: number, exposed: number, pending: boolean, out: Vector3) {
    const u = column / (COLUMNS - 1) * 2 - 1
    const distance = row === 0 ? 0 : (row - 1) * PITCH + this.leadingGap(exposed)
    const spread = 1 - Math.exp(-distance * 4.8)
    const edge = u * (0.700 + spread * 0.25)
    const folds = Math.sin(u * 9.2 + this.serial * 1.57) * 0.047 + Math.sin(u * 17 + distance * 4.2) * 0.021
    const drape = distance * 0.98 / (1 + distance * distance * 0.50)
    const y = TOP + 0.012 + drape - Math.abs(u) ** 2 * 0.13 * spread
    const z = (pending ? -0.071 : 0.004) + folds * (0.38 + spread) + distance * distance * 0.14
    return this.world(edge, y, z, out)
  }

  private leadingGap(exposed: number) {
    return Math.max(0.013, exposed - Math.floor(exposed / PITCH) * PITCH)
  }

  private setGuidedPaper(rows: PaperRow[], exposed: number, pending: boolean) {
    const rowCount = Math.min(SHEET_ROWS, Math.floor(exposed / PITCH) + 2)
    while (rows.length < rowCount) {
      rows.unshift({ id: SHEET_ROWS - rows.length - 1, points: Array.from({ length: COLUMNS }, node) })
    }
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < COLUMNS; c++) {
        const sample = rows[r].points[c]
        this.silhouette(r, c, exposed, pending, sample.position)
        sample.previous.copy(sample.position)
      }
    }
  }

  grab(row: number, column: number, target: Vector3): boolean {
    const sample = this.rows[row]?.points[column]
    if (!sample || row < 1) return false
    this.assistTime = 0
    this.releaseTime = 0
    this.grip = { point: sample, target: target.clone(), offset: sample.position.clone().sub(target) }
    return true
  }

  move(target: Vector3) {
    if (this.grip) this.grip.target.copy(target).add(this.grip.offset)
  }

  release(fling = false) {
    if (fling && this.grip) {
      this.releaseTime = 1 / 44
      return
    }
    this.grip = null
    this.assistTime = 0
    this.releaseTime = 0
  }

  pull(fast: boolean) {
    const row = this.rows.length - 1
    const column = fast ? 4 : 7
    if (!this.grip && this.grab(row, column, this.rows[row].points[column].position)) {
      this.assistFast = fast
      this.assistTime = fast ? 0.53 : 1.25
    }
  }

  private constrain(a: Point, b: Point, rest: number, stiffness: number, fixed = false) {
    const delta = this.difference.subVectors(b.position, a.position)
    const length = delta.length()
    if (length < 0.00001) return
    delta.multiplyScalar((1 - rest / length) * stiffness)
    if (!fixed) a.position.addScaledVector(delta, 0.5)
    b.position.addScaledVector(delta, fixed ? -1 : -0.5)
  }

  private relax(rows: PaperRow[], attached: boolean) {
    for (let r = 0; r < rows.length; r++) {
      const span = WIDTH * (attached && r === 1 ? 0.88 : 1) / (COLUMNS - 1)
      const spacing = attached && r === 0 ? this.leadingGap(this.exposed) : PITCH
      const diagonal = Math.hypot(span, spacing)
      const current = rows[r]
      const next = rows[r + 1]
      const far = rows[r + 2]
      const fixed = attached && r === 0
      for (let c = 0; c < COLUMNS; c++) {
        if (c + 1 < COLUMNS && !fixed) this.constrain(current.points[c], current.points[c + 1], span, 0.88)
        if (c + 2 < COLUMNS && !fixed) this.constrain(current.points[c], current.points[c + 2], span * 1.95, 0.21)
        if (!next) continue
        this.constrain(current.points[c], next.points[c], spacing, 0.93, fixed)
        if (c + 1 < COLUMNS) {
          this.constrain(current.points[c], next.points[c + 1], diagonal, fixed ? 0.22 : 0.42, fixed)
          this.constrain(current.points[c + 1], next.points[c], diagonal, fixed ? 0.22 : 0.42, fixed)
        }
        if (far) this.constrain(current.points[c], far.points[c], spacing + PITCH, 0.19, fixed)
      }
    }
  }

  private collide(sample: Point) {
    const p = sample.position
    if (p.y < FLOOR + 0.012) {
      p.y = FLOOR + 0.012
      sample.previous.x += (p.x - sample.previous.x) * 0.51
      sample.previous.z += (p.z - sample.previous.z) * 0.51
      sample.previous.y = p.y
    }
    const dx = p.x - this.box.x
    const dz = p.z - this.box.z
    const cos = Math.cos(this.box.yaw)
    const sin = Math.sin(this.box.yaw)
    const x = dx * cos - dz * sin
    const z = dx * sin + dz * cos
    const y = p.y - this.box.lift
    if (y > TOP + 0.014 || y < FLOOR || Math.abs(x) >= BOX_LENGTH / 2 || Math.abs(z) >= BOX_DEPTH / 2) return
    const nearTop = TOP + 0.014 - y
    const sideX = BOX_LENGTH / 2 - Math.abs(x)
    const sideZ = BOX_DEPTH / 2 - Math.abs(z)
    this.local.set(x, y, z)
    if (nearTop < Math.min(sideX, sideZ)) this.local.y = TOP + 0.014
    else if (sideX < sideZ) this.local.x = Math.sign(x || 1) * (BOX_LENGTH / 2 + 0.014)
    else this.local.z = Math.sign(z || 1) * (BOX_DEPTH / 2 + 0.014)
    this.world(this.local.x, this.local.y, this.local.z, p)
    sample.previous.lerp(p, 0.38)
  }

  private integrate(rows: PaperRow[], attached: boolean, dt: number) {
    for (let r = attached ? 1 : 0; r < rows.length; r++) {
      for (let c = 0; c < COLUMNS; c++) {
        const sample = rows[r].points[c]
        const velocity = this.difference.subVectors(sample.position, sample.previous).multiplyScalar(attached ? 0.973 : 0.982)
        velocity.z *= 0.95
        velocity.clampLength(0, 0.24)
        sample.previous.copy(sample.position)
        sample.position.add(velocity)
        sample.position.y -= 56 * dt * dt
        if (attached && (!this.grip || r < 3)) {
          const guide = this.silhouette(r, c, this.exposed, false, this.profile)
          const folding = r < 3 ? 0.32 : 0.225
          sample.position.lerp(guide, folding / (1 + this.tension * 0.34))
        }
      }
    }
  }

  replaceBox() {
    this.release()
    this.boxMotion.reset()
    this.speed = 0
    this.tension = 0
    this.exposed = EXPOSED
    this.rows = []
    this.upcoming = []
    this.setGuidedPaper(this.rows, this.exposed, false)
  }

  private advanceBox(dt: number, grip: Grip | null) {
    const { x, z, yaw, lift } = this.box
    const followsBox = this.boxMotion.grabbed || this.boxMotion.moving
    const impact = this.boxMotion.update(dt, this.load, grip ? grip.point.position.x - x : 0)
    if (impact > 0.95) this.events.impact?.(impact, this.box.x)
    if (!followsBox || (x === this.box.x && z === this.box.z && yaw === this.box.yaw && lift === this.box.lift)) return
    const c = Math.cos(this.box.yaw - yaw)
    const s = Math.sin(this.box.yaw - yaw)
    const offsetY = this.box.lift - lift
    for (const { points } of this.rows) {
      for (const { position, previous } of points) {
        for (const p of [position, previous]) {
          const localX = p.x - x
          const localZ = p.z - z
          p.set(localX * c + localZ * s + this.box.x, p.y + offsetY, -localX * s + localZ * c + this.box.z)
        }
      }
    }
  }

  private feed(dt: number) {
    const grip = this.grip?.piece ? null : this.grip
    if (grip) this.load.subVectors(grip.target, grip.point.position).multiplyScalar(7.4).clampLength(0, 10)
    else this.load.set(0, 0, 0)
    this.advanceBox(dt, grip)
    const upward = Math.max(0, this.load.y)
    const sideways = Math.hypot(this.load.x, this.load.z)
    const resistance = 0.53 + sideways * 0.12 + Math.sin(this.exposed * 24 + this.serial) * 0.095
    const effort = upward + sideways * 0.48
    this.tension += (effort - this.tension) * 0.32
    this.speed = this.boxMotion.grabbed ? 0 : clamp(this.speed + (Math.max(0, effort - resistance) * 11 - this.speed * 7.1) * dt, 0, 6.5)
    const travel = Math.min(TOTAL - this.exposed, this.speed * dt)
    this.exposed += travel
    this.produced += travel

    const wanted = Math.min(SHEET_ROWS, Math.floor(this.exposed / PITCH) + 2)
    while (this.rows.length < wanted) {
      const points = Array.from({ length: COLUMNS }, (_, column) => {
        const sample = node()
        this.silhouette(0, column, this.exposed, false, sample.position)
        sample.previous.copy(sample.position)
        return sample
      })
      this.rows.unshift({ id: SHEET_ROWS - this.rows.length - 1, points })
    }

    // The last fold drags an overlapping edge through the slot before separation.
    const coupling = clamp(1 - (TOTAL - this.exposed) / COUPLING_DISTANCE, 0, 1)
    if (coupling > 0.035) this.setGuidedPaper(this.upcoming, EXPOSED * coupling, true)
  }

  step(dt: number) {
    if (this.assistTime > 0 && this.grip) {
      this.grip.target.y += dt * (this.assistFast ? 9.8 : 2.15)
      this.grip.target.x += dt * (this.assistFast ? 2.9 : 0.08)
      this.grip.target.z += dt * (this.assistFast ? 1.2 : 0.33)
      this.assistTime -= dt
      if (this.assistTime <= 0) this.release()
    }
    this.feed(dt)
    this.rows[0].points.forEach((sample, column) => this.silhouette(0, column, this.exposed, false, sample.position))
    this.integrate(this.rows, true, dt)
    for (const offcut of this.offcuts) {
      if (this.grip?.piece !== offcut) offcut.age += dt
      if (offcut.age < 3.5) this.integrate(offcut.rows, false, dt)
    }
    const held = this.grip?.piece ? this.grip : null
    if (held) {
      const delta = this.difference.subVectors(held.target, held.point.position).clampLength(0, 0.25)
      this.heldPosition.copy(held.point.position).add(delta)
    }
    for (let i = 0; i < 6; i++) {
      this.relax(this.rows, true)
      const grip = this.grip
      if (grip && !grip.piece) this.applyGrip(grip)
      for (let r = 1; r < this.rows.length; r++) for (const sample of this.rows[r].points) this.collide(sample)
      for (const offcut of this.offcuts) {
        if (offcut.age >= 3.5) continue
        this.relax(offcut.rows, false)
        if (held?.piece === offcut) held.point.position.copy(this.heldPosition)
        for (const row of offcut.rows) for (const sample of row.points) this.collide(sample)
      }
    }

    if (this.exposed >= TOTAL - 1e-6) {
      const strength = Math.min(6, this.speed + this.tension * 0.35)
      const pan = this.grip?.point.position.x ?? this.box.x
      // Transfer the remaining pull to the folds that were held back by the slot.
      const impulse = this.difference.copy(this.load).multiplyScalar(dt * 0.56).clampLength(0, 0.052)
      for (let r = 0; r < this.rows.length; r++) {
        const weight = 0.92 - r / this.rows.length * 0.75
        for (const sample of this.rows[r].points) sample.previous.addScaledVector(impulse, -weight)
      }
      const piece = { rows: this.rows, age: 0 }
      this.offcuts.push(piece)
      if (this.offcuts.length > 7) this.offcuts.shift()
      this.rows = this.upcoming
      this.upcoming = []
      this.exposed = EXPOSED
      this.serial++
      this.speed = 0
      if (this.grip && this.assistTime <= 0 && this.releaseTime <= 0) this.grip.piece = piece
      else this.release()
      this.events.draw(strength, pan)
    }
    if (this.releaseTime > 0) {
      this.releaseTime -= dt
      if (this.releaseTime <= 0) this.release()
    }
  }

  private applyGrip(grip: Grip) {
    grip.point.position.add(this.difference.subVectors(grip.target, grip.point.position).clampLength(0, 0.29).multiplyScalar(0.19))
  }
}
