import { Box3, Triangle, Vector3 } from 'three'
import {
  BOX_DEPTH, BOX_LENGTH, FLOOR, PAPER_CLEARANCE, REAR_WALL, TOP, type CartonPose, type PaperPoint, type PaperRow,
} from './tissueDimensions'

const halfX = BOX_LENGTH / 2
const halfZ = BOX_DEPTH / 2
const margin = 0.009

type Axis = 'x' | 'y' | 'z'
type Face = { axis: Axis; sign: -1 | 1; plane: number }
type Frame = CartonPose & { cos: number; sin: number }

const min = new Vector3(-halfX, FLOOR + 0.002, -halfZ)
const max = new Vector3(halfX, TOP, halfZ)
const shell = new Box3(min.clone().addScalar(0.0008), max.clone().addScalar(-0.0008))
const faces: Face[] = [
  { axis: 'x', sign: -1, plane: min.x }, { axis: 'x', sign: 1, plane: max.x },
  { axis: 'y', sign: -1, plane: min.y }, { axis: 'y', sign: 1, plane: max.y },
  { axis: 'z', sign: -1, plane: min.z }, { axis: 'z', sign: 1, plane: max.z },
]
const axes = ['x', 'y', 'z'] as const

const frame = (pose: CartonPose): Frame => ({ ...pose, cos: Math.cos(pose.yaw), sin: Math.sin(pose.yaw) })

function toLocal(out: Vector3, p: Vector3, box: Frame) {
  const dx = p.x - box.x
  const dz = p.z - box.z
  return out.set(dx * box.cos - dz * box.sin, p.y - box.lift, dx * box.sin + dz * box.cos)
}

function inBox(p: Vector3) {
  return p.x > min.x && p.x < max.x && p.y > min.y && p.y < max.y && p.z > min.z && p.z < max.z
}

export class CartonContacts {
  private previous = frame({ x: 0, z: 0, yaw: 0, lift: 0 })
  private current = this.previous
  private columnMargin = 0
  private readonly start = new Vector3()
  private readonly end = new Vector3()
  private readonly correction = new Vector3()
  private readonly shellTriangle = new Triangle()

  begin(before: CartonPose, after: CartonPose) {
    this.previous = frame(before)
    this.current = frame(after)
    this.columnMargin = Math.hypot(after.x - before.x, after.z - before.z, after.lift - before.lift)
      + Math.abs(after.yaw - before.yaw) * Math.hypot(halfX, halfZ)
  }

  reaches(bounds: Box3): boolean {
    if (this.columnMargin < 0.00014) return false
    const box = this.current
    const reachX = halfX * Math.abs(box.cos) + halfZ * Math.abs(box.sin) + this.columnMargin + 0.035
    const reachZ = halfX * Math.abs(box.sin) + halfZ * Math.abs(box.cos) + this.columnMargin + 0.035
    return bounds.min.x <= box.x + reachX && bounds.max.x >= box.x - reachX
      && bounds.min.z <= box.z + reachZ && bounds.max.z >= box.z - reachZ
      && bounds.min.y <= box.lift + TOP + this.columnMargin
      && bounds.max.y >= box.lift + FLOOR - this.columnMargin - 0.045
  }

  private canSlideOut(face: Face): boolean {
    // At touchdown there is no room to push a sheet through the tabletop.
    return face.axis !== 'y' || face.sign === 1 || this.current.lift > PAPER_CLEARANCE + margin + 0.003
  }

  private entry(from: Vector3, to: Vector3): Face | undefined {
    if (inBox(from)) return undefined
    let near = 0
    let far = 1
    let crossed: Face | undefined
    for (let i = 0; i < 3; i++) {
      const axis = axes[i]
      const delta = to[axis] - from[axis]
      if (Math.abs(delta) < 1e-8) {
        if (from[axis] < min[axis] || from[axis] > max[axis]) return undefined
        continue
      }
      const enter = ((delta > 0 ? min : max)[axis] - from[axis]) / delta
      const exit = ((delta > 0 ? max : min)[axis] - from[axis]) / delta
      if (enter >= near) {
        near = enter
        crossed = faces[i * 2 + (delta > 0 ? 0 : 1)]
      }
      far = Math.min(far, exit)
      if (far < near) return undefined
    }
    return crossed
  }

  private closestFace(p: Vector3, horizontal: boolean): Face {
    let best = faces[0]
    let distance = Infinity
    for (const face of faces) {
      if ((horizontal && face.axis === 'y') || !this.canSlideOut(face)) continue
      const depth = (face.plane - p[face.axis]) * face.sign
      const score = Math.abs(depth)
      if (score < distance) { distance = score; best = face }
    }
    return best
  }

  private push(point: PaperPoint, face: Face, amount: number, damping: number) {
    const box = this.current
    const delta = this.correction
    if (face.axis === 'x') delta.set(box.cos * amount, 0, -box.sin * amount)
    else if (face.axis === 'z') delta.set(box.sin * amount, 0, box.cos * amount)
    else delta.set(0, amount, 0)
    point.position.add(delta)
    point.previous.addScaledVector(delta, damping)
  }

  projectPoint(point: PaperPoint, swept: boolean, attached: boolean): boolean {
    if (point.position.y > this.current.lift + TOP + Math.max(this.columnMargin, 0.11) && !swept) return false
    const local = toLocal(this.end, point.position, this.current)
    const inside = inBox(local)
    if (!swept && !inside) return false
    let face = swept ? this.entry(toLocal(this.start, point.previous, this.previous), local) : undefined
    if (face && !this.canSlideOut(face)) {
      if (!inside) return false
      face = this.closestFace(local, true)
    }
    if (!face && !inside) return false
    face ??= this.closestFace(local, false)
    // The exposed strip is fed upward through a fixed anchor in the slit.
    if (attached && inside && local.y > TOP - 0.095) face = faces[3]
    const amount = face.plane + face.sign * margin - local[face.axis]
    if (amount * face.sign <= 0) return false
    this.push(point, face, amount, swept && this.columnMargin > 0.001 ? 0.67 : 0.83)
    return true
  }

  projectSurface(rows: PaperRow[], anchored: boolean): number {
    let count = 0
    for (let r = 0; r < rows.length - 1; r++) {
      const current = rows[r].points
      const next = rows[r + 1].points
      for (let c = 0; c < current.length - 1; c++) {
        count += this.projectTriangle(current[c], next[c], current[c + 1], r === 0 && anchored, false, r === 0 && anchored)
        count += this.projectTriangle(current[c + 1], next[c], next[c + 1], r === 0 && anchored, false, false)
      }
    }
    return count
  }

  private projectTriangle(a: PaperPoint, b: PaperPoint, c: PaperPoint, lockA: boolean, lockB: boolean, lockC: boolean): number {
    const worldTop = this.current.lift + TOP
    if (a.position.y >= worldTop && b.position.y >= worldTop && c.position.y >= worldTop) return 0
    const tri = this.shellTriangle
    toLocal(tri.a, a.position, this.current)
    toLocal(tri.b, b.position, this.current)
    toLocal(tri.c, c.position, this.current)
    for (const axis of axes) {
      if (Math.min(tri.a[axis], tri.b[axis], tri.c[axis]) >= shell.max[axis]
        || Math.max(tri.a[axis], tri.b[axis], tri.c[axis]) <= shell.min[axis]) return 0
    }
    if (!shell.intersectsTriangle(tri)) return 0

    let best: Face | undefined
    let bestAmount = 0
    let cost = Infinity
    for (const candidate of faces) {
      if (!this.canSlideOut(candidate)) continue
      const { axis, sign, plane } = candidate
      if ((lockA && (tri.a[axis] - plane) * sign < 0)
        || (lockB && (tri.b[axis] - plane) * sign < 0)
        || (lockC && (tri.c[axis] - plane) * sign < 0)) continue
      const extreme = sign === 1
        ? Math.min(tri.a[axis], tri.b[axis], tri.c[axis])
        : Math.max(tri.a[axis], tri.b[axis], tri.c[axis])
      const amount = Math.max(0, (plane - extreme) * sign) + margin
      if (amount < cost) {
        best = candidate
        bestAmount = amount
        cost = amount
      }
    }
    if (!best) return 0
    const { axis, plane, sign } = best
    // Keep the off-surface part of the fold free instead of translating the entire face.
    const target = plane + sign * margin
    if (!lockA && (target - tri.a[axis]) * sign > 0) this.push(a, best, target - tri.a[axis], 0.74)
    if (!lockB && (target - tri.b[axis]) * sign > 0) this.push(b, best, target - tri.b[axis], 0.74)
    if (!lockC && (target - tri.c[axis]) * sign > 0) this.push(c, best, target - tri.c[axis], 0.74)
    return bestAmount > 0 ? 1 : 0
  }
}

export function projectTable(point: PaperPoint) {
  const { position, previous } = point
  if (position.z < REAR_WALL + PAPER_CLEARANCE) {
    position.z = REAR_WALL + PAPER_CLEARANCE
    previous.z = position.z
  }
  if (position.y >= FLOOR + PAPER_CLEARANCE) return
  position.y = FLOOR + PAPER_CLEARANCE
  previous.x += (position.x - previous.x) * 0.48
  previous.z += (position.z - previous.z) * 0.48
  previous.y = position.y
}
