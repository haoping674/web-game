import { Box3, Vector3 } from 'three'
import { BoxMotion } from './boxMotion'
import { CartonContacts, projectTable } from './cartonContacts'
import { PaperLayerContacts, paperBounds, type ContactLayer } from './paperLayerContacts'
import { COLUMNS, LIP_HALF_DEPTH, LIP_HALF_LENGTH, PITCH, SHEET_ROWS, TOP, WIDTH, type CartonPose, type PaperPoint, type PaperRow } from './tissueDimensions'

export { BOX_DEPTH, BOX_HEIGHT, BOX_LENGTH, COLUMNS, FLOOR, PITCH, SHEET_ROWS, SLOT_HALF_DEPTH, SLOT_HALF_LENGTH, WIDTH } from './tissueDimensions'
export type { PaperRow } from './tissueDimensions'

const COUPLING_DISTANCE = 0.58
const EXPOSED = 0.52
const TOTAL = (SHEET_ROWS - 1) * PITCH

type Point = PaperPoint
type PaperBends = { across: Float32Array; along: Float32Array }
export type Offcut = { rows: PaperRow[]; bends: PaperBends; age: number; awake: number; version: number; bounds: Box3 }
type Grip = { point: Point; target: Vector3; offset: Vector3; piece?: Offcut }
export type PaperEvents = { draw: (strength: number, pan: number) => void; impact?: (strength: number, pan: number) => void }

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))
const node = (): Point => ({ position: new Vector3(), previous: new Vector3() })

function captureBends(rows: PaperRow[]): PaperBends {
  const across = new Float32Array(rows.length * COLUMNS)
  const along = new Float32Array(rows.length * COLUMNS)
  const acrossSpan = 2 * WIDTH / (COLUMNS - 1)
  const alongSpan = 2 * PITCH
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < COLUMNS; c++) {
      const point = rows[r].points[c].position
      const index = r * COLUMNS + c
      if (c + 2 < COLUMNS) {
        across[index] = clamp(point.distanceTo(rows[r].points[c + 2].position), acrossSpan * 0.52, acrossSpan)
      }
      if (r + 2 < rows.length) {
        along[index] = clamp(point.distanceTo(rows[r + 2].points[c].position), alongSpan * 0.52, alongSpan)
      }
    }
  }
  return { across, along }
}

export class PaperPhysics {
  rows: PaperRow[] = []
  upcoming: PaperRow[] = []
  offcuts: Offcut[] = []
  speed = 0
  tension = 0
  lipDeflection = 0
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
  private load = new Vector3()
  private heldPosition = new Vector3()
  private readonly carton = new CartonContacts()
  private readonly paperContacts = new PaperLayerContacts()
  private readonly activeBounds = new Box3()
  private readonly upcomingBounds = new Box3()
  private readonly upcomingGuides = new WeakMap<Point, Vector3>()
  private readonly previousBox: CartonPose = { x: 0, z: 0, lift: 0, yaw: 0 }
  private contactTick = 0
  private priorLip = 0

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
    const edge = u * (LIP_HALF_LENGTH - 0.025 + spread * 0.26)
    const folds = Math.sin(u * 9.2 + this.serial * 1.57) * 0.047 + Math.sin(u * 17 + distance * 4.2) * 0.021
    const drape = distance * 0.98 / (1 + distance * distance * 0.50)
    const y = TOP + 0.010 + drape - Math.abs(u) ** 2 * 0.13 * spread
    const slitCenter = pending ? -LIP_HALF_DEPTH * 0.53 : LIP_HALF_DEPTH * 0.36
    const exit = clamp(slitCenter + (pending ? 0 : this.lipDeflection * 0.6) + folds * 0.21, -LIP_HALF_DEPTH + 0.010, LIP_HALF_DEPTH - 0.010)
    const z = exit + folds * spread + distance * distance * 0.14
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
        const guide = this.silhouette(r, c, exposed, pending, this.profile)
        const prior = pending ? this.upcomingGuides.get(sample) : undefined
        if (prior && r > 0) {
          // Feed from the slot without erasing a fold displaced by another sheet.
          const delta = this.difference.subVectors(guide, prior)
          sample.position.add(delta)
          sample.previous.add(delta)
        } else {
          sample.position.copy(guide)
          sample.previous.copy(guide)
        }
        if (pending) {
          if (prior) prior.copy(guide)
          else this.upcomingGuides.set(sample, guide.clone())
        }
      }
    }
  }

  grab(row: number, column: number, target: Vector3, piece?: Offcut): boolean {
    if (piece ? !this.offcuts.includes(piece) : row < 1) return false
    const sample = (piece?.rows ?? this.rows)[row]?.points[column]
    if (!sample) return false
    this.assistTime = 0
    this.releaseTime = 0
    this.grip = { point: sample, target: sample.position.clone(), offset: sample.position.clone().sub(target), piece }
    if (piece) this.wake(piece)
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
    const piece = this.grip?.piece
    if (piece) piece.awake = Math.max(piece.awake, 1.25)
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

  private relax(rows: PaperRow[], attached: boolean, bends?: PaperBends) {
    for (let r = 0; r < rows.length; r++) {
      const span = WIDTH * (attached && r === 1 ? 0.88 : 1) / (COLUMNS - 1)
      const spacing = attached && r === 0 ? this.leadingGap(this.exposed) : PITCH
      const diagonal = Math.hypot(span, spacing)
      const current = rows[r]
      const next = rows[r + 1]
      const far = rows[r + 2]
      const fixed = attached && r === 0
      for (let c = 0; c < COLUMNS; c++) {
        const index = r * COLUMNS + c
        if (c + 1 < COLUMNS && !fixed) this.constrain(current.points[c], current.points[c + 1], span, 0.88)
        if (c + 2 < COLUMNS && !fixed) this.constrain(current.points[c], current.points[c + 2], bends?.across[index] ?? span * 1.95, bends ? 0.30 : 0.21)
        if (!next) continue
        this.constrain(current.points[c], next.points[c], spacing, 0.93, fixed)
        if (c + 1 < COLUMNS) {
          this.constrain(current.points[c], next.points[c + 1], diagonal, fixed ? 0.22 : 0.42, fixed)
          this.constrain(current.points[c + 1], next.points[c], diagonal, fixed ? 0.22 : 0.42, fixed)
        }
        if (far) this.constrain(current.points[c], far.points[c], bends?.along[index] ?? spacing + PITCH, bends ? 0.28 : 0.19, fixed)
      }
    }
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
        if (attached && (!this.grip || this.grip.piece || r < 3)) {
          const guide = this.silhouette(r, c, this.exposed, false, this.profile)
          const folding = r < 3 ? 0.32 : 0.225 / (1 + Math.max(0, r - 7) * 0.20)
          sample.position.lerp(guide, folding / (1 + this.tension * 0.34))
        }
      }
    }
  }

  replaceBox() {
    this.release()
    this.boxMotion.reset()
    this.carton.begin(this.box, this.box)
    for (const piece of this.offcuts) this.wake(piece)
    this.speed = 0
    this.tension = 0
    this.lipDeflection = 0
    this.priorLip = 0
    this.exposed = EXPOSED
    this.rows = []
    this.upcoming = []
    this.setGuidedPaper(this.rows, this.exposed, false)
  }

  private advanceBox(dt: number, grip: Grip | null) {
    Object.assign(this.previousBox, this.box)
    const { x, z, yaw, lift } = this.box
    const followsBox = this.boxMotion.grabbed || this.boxMotion.moving
    const impact = this.boxMotion.update(dt, this.load, grip ? grip.point.position.x - x : 0)
    this.carton.begin(this.previousBox, this.box)
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
    const lipNormal = Math.sin(this.box.yaw) * this.load.x + Math.cos(this.box.yaw) * this.load.z
    const lipTarget = clamp(lipNormal * 0.009, -0.036, 0.036)
    this.priorLip += (lipTarget - this.priorLip) * dt * 20
    this.lipDeflection += (this.priorLip - this.lipDeflection) * dt * 28
    const lipFriction = Math.abs(lipNormal) * 0.085 + Math.abs(this.lipDeflection) * 3
    const resistance = (this.speed < 0.16 ? 0.61 : 0.45) + sideways * 0.13 + lipFriction
      + Math.sin(this.exposed * 24 + this.serial) * 0.084
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
    this.rows[0].points.forEach((sample, column) => {
      sample.previous.copy(sample.position)
      this.silhouette(0, column, this.exposed, false, sample.position)
    })
    this.integrate(this.rows, true, dt)
    for (const offcut of this.offcuts) {
      if (this.grip?.piece !== offcut) offcut.age += dt
      if (offcut.awake <= 0 && this.carton.reaches(offcut.bounds)) {
        const touched = this.enforce(offcut.rows, false, true)
        if (touched || this.carton.projectSurface(offcut.rows, false)) this.wake(offcut)
      }
      if (offcut.awake > 0) {
        this.integrate(offcut.rows, false, dt)
        this.enforce(offcut.rows, false, true)
      }
    }
    this.enforce(this.rows, true, true)
    const held = this.grip?.piece ? this.grip : null
    if (held) {
      const delta = this.difference.subVectors(held.target, held.point.position).clampLength(0, 0.25)
      this.heldPosition.copy(held.point.position).add(delta)
    }
    for (let i = 0; i < 6; i++) {
      this.relax(this.rows, true)
      const grip = this.grip
      if (grip && !grip.piece) this.applyGrip(grip)
      this.enforce(this.rows, true, false)
      for (const offcut of this.offcuts) {
        if (offcut.awake <= 0) continue
        this.relax(offcut.rows, false, offcut.bends)
        if (held?.piece === offcut) held.point.position.copy(this.heldPosition)
        this.enforce(offcut.rows, false, false)
      }
    }

    if (this.contactTick++ % 3 === 0 || this.upcoming.length > 1) this.solveLayers()
    this.finishSurface(this.rows, true)
    if (this.upcoming.length) this.finishSurface(this.upcoming, true)
    for (const piece of this.offcuts) {
      if (piece.awake <= 0) continue
      this.finishSurface(piece.rows, false)
      if (held?.piece !== piece) piece.awake = Math.max(0, piece.awake - dt)
      if (piece.awake === 0) for (const { points } of piece.rows) {
        for (const point of points) point.previous.copy(point.position)
      }
      piece.version++
      paperBounds(piece.rows, piece.bounds)
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
      const piece: Offcut = {
        rows: this.rows, bends: captureBends(this.rows), age: 0, awake: 3.0, version: 0,
        bounds: paperBounds(this.rows, new Box3()),
      }
      this.offcuts.push(piece)
      if (this.offcuts.length > 7) {
        const oldestFree = this.offcuts[0] === this.grip?.piece ? 1 : 0
        this.offcuts.splice(oldestFree, 1)
      }
      this.rows = this.upcoming
      this.upcoming = []
      this.exposed = EXPOSED
      this.serial++
      this.speed = 0
      if (!this.grip?.piece) {
        if (this.grip && this.assistTime <= 0 && this.releaseTime <= 0) this.grip.piece = piece
        else this.release()
      }
      this.events.draw(strength, pan)
    }
    if (this.releaseTime > 0) {
      this.releaseTime -= dt
      if (this.releaseTime <= 0) this.release()
    }
  }

  private wake(piece: Offcut) {
    piece.awake = Math.max(piece.awake, 0.82)
  }

  private enforce(rows: PaperRow[], anchored: boolean, swept: boolean): boolean {
    let touched = false
    for (let r = anchored ? 1 : 0; r < rows.length; r++) {
      for (const point of rows[r].points) {
        projectTable(point)
        if (this.carton.projectPoint(point, swept, anchored)) touched = true
        projectTable(point)
      }
    }
    return touched
  }

  private finishSurface(rows: PaperRow[], anchored: boolean) {
    this.enforce(rows, anchored, false)
    // An edge can enter a corner even when all its vertices are outside the carton.
    for (let pass = 0; pass < 3; pass++) {
      if (!this.carton.projectSurface(rows, anchored)) break
    }
  }

  private solveLayers() {
    const activeFold = (this.grip !== null && !this.grip.piece || this.speed > 0.12) && this.rows.length > 8
    if (!activeFold && !this.upcoming.length && this.offcuts.every((piece) => piece.awake <= 0)) return
    const layers: ContactLayer[] = [{
      rows: this.rows,
      bounds: paperBounds(this.rows, this.activeBounds, true),
      anchored: true,
      sleeping: false,
      folding: activeFold,
    }]
    if (this.upcoming.length) layers.push({
      rows: this.upcoming,
      bounds: paperBounds(this.upcoming, this.upcomingBounds),
      anchored: true,
      sleeping: false,
    })
    for (const piece of this.offcuts) layers.push({
      rows: piece.rows,
      bounds: piece.awake > 0 ? paperBounds(piece.rows, piece.bounds, true) : piece.bounds,
      anchored: false,
      sleeping: piece.awake <= 0,
      folding: this.grip?.piece === piece || piece.age < 0.82,
      wake: piece.awake <= 0 ? () => this.wake(piece) : undefined,
    })
    this.paperContacts.solve(layers)
  }

  private applyGrip(grip: Grip) {
    grip.point.position.add(this.difference.subVectors(grip.target, grip.point.position).clampLength(0, 0.29).multiplyScalar(0.19))
  }
}
