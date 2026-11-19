import { Box3, Vector3 } from 'three'
import { COLUMNS, type PaperPoint, type PaperRow } from './tissueDimensions'

const CELL = 0.195
export const LAYER_GAP = 0.019

export type ContactLayer = {
  rows: PaperRow[]
  bounds: Box3
  anchored: boolean
  sleeping: boolean
  folding?: boolean
  driven?: boolean
  receivePull?: (motion: Vector3) => void
  wake?: () => void
}

type Face = {
  layer: ContactLayer
  a: PaperPoint
  b: PaperPoint
  c: PaperPoint
  row: number
  column: number
  fixed: number
  visited: number
}

const key = (x: number, y: number, z: number) => x + y * 1024 + z * 1048576

export function paperBounds(rows: PaperRow[], out: Box3, swept = false): Box3 {
  out.makeEmpty()
  for (const { points } of rows) for (const point of points) {
    out.expandByPoint(point.position)
    if (swept) out.expandByPoint(point.previous)
  }
  return out
}

/** Thin surface contacts use the previous side of the triangle to preserve fold order. */
export class PaperLayerContacts {
  private readonly cells = new Map<number, Face[]>()
  private readonly edgeA = new Vector3()
  private readonly edgeB = new Vector3()
  private readonly normal = new Vector3()
  private readonly relative = new Vector3()
  private readonly prior = new Vector3()
  private readonly hit = new Vector3()
  private readonly correction = new Vector3()
  private readonly oldNormal = new Vector3()
  private readonly oldEdge = new Vector3()
  private readonly sweepOrigin = new Vector3()
  private readonly sweepBounds = new Box3()
  private readonly motion = new Vector3()
  private readonly friction = new Vector3()
  private readonly candidates: ContactLayer[] = []
  private readonly lastSolved = new WeakMap<PaperPoint, Vector3>()
  private serial = 0
  private meetsBoxPaper = false

  solve(layers: ContactLayer[], projectSurfaces?: () => void) {
    this.meetsBoxPaper = false
    const visible = this.candidates
    visible.length = 0
    for (const layer of layers) if (!layer.sleeping) {
      for (const { points } of layer.rows) for (const point of points) {
        const prior = this.lastSolved.get(point)
        if (prior) layer.bounds.expandByPoint(prior)
      }
    }
    for (const layer of layers) {
      if (layer.rows.length < 2) continue
      if (!layer.folding || layer.sleeping) {
        const nearMovingSheet = layers.some((other) =>
          other !== layer && (!layer.sleeping || !other.sleeping) && this.overlap(layer.bounds, other.bounds))
        if (!nearMovingSheet) continue
      }
      visible.push(layer)
    }
    this.resolve(visible, false)
    projectSurfaces?.()
    if (this.meetsBoxPaper) {
      // Re-index the faces after paper and carton constraints have both moved them.
      this.resolve(visible.filter((layer) => layer.driven || layer.anchored), true)
      projectSurfaces?.()
    }
    for (const layer of layers) if (!layer.sleeping) {
      for (const { points } of layer.rows) for (const point of points) {
        const saved = this.lastSolved.get(point)
        if (saved) saved.copy(point.position)
        else this.lastSolved.set(point, point.position.clone())
      }
    }
  }

  private resolve(visible: ContactLayer[], boxPairOnly: boolean) {
    this.cells.clear()
    const swept = visible.some((layer) => layer.driven) && visible.some((layer) => layer.anchored)
    for (const layer of visible) this.index(layer, swept && !layer.sleeping && !!(layer.driven || layer.anchored))
    for (const layer of visible) {
      if (layer.sleeping) continue
      for (let r = layer.anchored ? 1 : 0; r < layer.rows.length; r++) {
        const row = layer.rows[r]
        for (let c = 0; c < row.points.length; c++) this.resolvePoint(layer, row.points[c], r, c, boxPairOnly)
      }
    }
    for (const layer of visible) {
      if (layer.sleeping) continue
      for (let r = 0; r < layer.rows.length; r++) {
        const row = layer.rows[r].points
        const next = layer.rows[r + 1]?.points
        const pinned = layer.anchored && r === 0
        for (let c = 0; c < row.length; c++) {
          if (!pinned && row[c + 1]) this.resolveEdge(layer, row[c], row[c + 1], r, c, false, boxPairOnly)
          if (next) {
            this.resolveEdge(layer, row[c], next[c], r, c, pinned, boxPairOnly)
            if (row[c + 1]) this.resolveEdge(layer, row[c + 1], next[c], r, c, pinned, boxPairOnly)
          }
        }
      }
    }
  }

  private oldPosition(point: PaperPoint): Vector3 {
    return this.lastSolved.get(point) ?? point.previous
  }

  private resolveEdge(layer: ContactLayer, start: PaperPoint, end: PaperPoint, row: number, column: number, pinned: boolean, boxPairOnly: boolean) {
    const a = start.position
    const b = end.position
    const minX = Math.floor(Math.min(a.x, b.x) / CELL)
    const minY = Math.floor(Math.min(a.y, b.y) / CELL)
    const minZ = Math.floor(Math.min(a.z, b.z) / CELL)
    const maxX = Math.floor(Math.max(a.x, b.x) / CELL)
    const maxY = Math.floor(Math.max(a.y, b.y) / CELL)
    const maxZ = Math.floor(Math.max(a.z, b.z) / CELL)
    const serial = ++this.serial
    for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) for (let z = minZ; z <= maxZ; z++) {
      const faces = this.cells.get(key(x, y, z))
      if (!faces) continue
      for (const face of faces) {
        if (face.visited === serial) continue
        face.visited = serial
        if (boxPairOnly && !this.boxPair(layer, face.layer)) continue
        if (face.layer === layer && (!layer.folding || (row >= face.row - 1 && row <= face.row + 2
          && column >= face.column - 1 && column <= face.column + 2))) continue
        if (this.separateCrossing(layer, start, end, face, pinned)) return
      }
    }
  }

  private separateCrossing(layer: ContactLayer, start: PaperPoint, end: PaperPoint, face: Face, pinned: boolean): boolean {
    const a = face.a.position
    const b = face.b.position
    const c = face.c.position
    const p = start.position
    const q = end.position
    if (Math.max(p.x, q.x) < Math.min(a.x, b.x, c.x) || Math.min(p.x, q.x) > Math.max(a.x, b.x, c.x)
      || Math.max(p.y, q.y) < Math.min(a.y, b.y, c.y) || Math.min(p.y, q.y) > Math.max(a.y, b.y, c.y)
      || Math.max(p.z, q.z) < Math.min(a.z, b.z, c.z) || Math.min(p.z, q.z) > Math.max(a.z, b.z, c.z)) return false
    const ab = this.edgeA.subVectors(b, a)
    const ac = this.edgeB.subVectors(c, a)
    const normal = this.normal.crossVectors(ab, ac)
    const area = normal.lengthSq()
    if (area < 1e-9) return false
    normal.multiplyScalar(1 / Math.sqrt(area))
    const d0 = normal.dot(this.relative.subVectors(p, a))
    const d1 = normal.dot(this.prior.subVectors(q, a))
    if (d0 * d1 >= -1e-9) return false
    const hit = this.hit.copy(this.relative).lerp(this.prior, d0 / (d0 - d1))
    const uu = ab.lengthSq()
    const vv = ac.lengthSq()
    const uv = ab.dot(ac)
    const hu = hit.dot(ab)
    const hv = hit.dot(ac)
    const wb = (hu * vv - hv * uv) / area
    const wc = (hv * uu - hu * uv) / area
    if (wb < -0.0001 || wc < -0.0001 || wb + wc > 1.0001) return false

    const old0 = this.priorDistance(start, face)
    const old1 = this.priorDistance(end, face)
    const sameSide = old0 * old1 > 0 && Math.min(Math.abs(old0), Math.abs(old1)) > 0.003
    const remembered = sameSide ? old0 + old1 : Math.abs(d0) > Math.abs(d1) ? d0 : d1
    const side = Math.sign(pinned ? d0 : remembered)
    const point = side * d0 < 0 ? start : end
    const distance = point === start ? d0 : d1
    const self = face.layer === layer
    const wake = face.layer.sleeping && sameSide && Math.abs(distance) > LAYER_GAP * 2
      && Math.abs(this.normalMotion(point, normal)) > 0.025
    // Keep uncertain self crossings from snapping an entire edge to the other side.
    const limit = self ? 0.018 : face.layer.sleeping ? Infinity : this.boxPair(layer, face.layer) ? 0.14 : 0.065
    this.respond(layer, point, face, side, Math.min(limit, LAYER_GAP - side * distance), wb, wc, wake, true)
    return true
  }

  private boxPair(a: ContactLayer, b: ContactLayer) {
    return (a.driven && b.anchored) || (a.anchored && b.driven)
  }

  private overlap(a: Box3, b: Box3) {
    return a.min.x <= b.max.x + LAYER_GAP && a.max.x >= b.min.x - LAYER_GAP
      && a.min.y <= b.max.y + LAYER_GAP && a.max.y >= b.min.y - LAYER_GAP
      && a.min.z <= b.max.z + LAYER_GAP && a.max.z >= b.min.z - LAYER_GAP
  }

  private index(layer: ContactLayer, swept: boolean) {
    for (let r = 0; r < layer.rows.length - 1; r++) {
      const top = layer.rows[r].points
      const below = layer.rows[r + 1].points
      const fixed = r === 0 && layer.anchored
      for (let c = 0; c < COLUMNS - 1; c++) {
        this.insert({ layer, row: r, column: c, a: top[c], b: below[c], c: top[c + 1], fixed: fixed ? 5 : 0, visited: 0 }, swept)
        this.insert({ layer, row: r, column: c, a: top[c + 1], b: below[c], c: below[c + 1], fixed: fixed ? 1 : 0, visited: 0 }, swept)
      }
    }
  }

  private insert(face: Face, swept: boolean) {
    const { position: a } = face.a
    const { position: b } = face.b
    const { position: c } = face.c
    const { min, max } = this.sweepBounds.makeEmpty().expandByPoint(a).expandByPoint(b).expandByPoint(c)
    if (swept) this.sweepBounds.expandByPoint(this.oldPosition(face.a))
      .expandByPoint(this.oldPosition(face.b)).expandByPoint(this.oldPosition(face.c))
    const minX = Math.floor((min.x - LAYER_GAP) / CELL)
    const minY = Math.floor((min.y - LAYER_GAP) / CELL)
    const minZ = Math.floor((min.z - LAYER_GAP) / CELL)
    const maxX = Math.floor((max.x + LAYER_GAP) / CELL)
    const maxY = Math.floor((max.y + LAYER_GAP) / CELL)
    const maxZ = Math.floor((max.z + LAYER_GAP) / CELL)
    for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) for (let z = minZ; z <= maxZ; z++) {
      const id = key(x, y, z)
      const bucket = this.cells.get(id)
      if (bucket) bucket.push(face)
      else this.cells.set(id, [face])
    }
  }

  private resolvePoint(layer: ContactLayer, point: PaperPoint, row: number, column: number, boxPairOnly: boolean) {
    const p = point.position
    const q = this.oldPosition(point)
    const moveX = Math.max(p.x - CELL * 2, Math.min(p.x + CELL * 2, q.x))
    const moveY = Math.max(p.y - CELL * 2, Math.min(p.y + CELL * 2, q.y))
    const moveZ = Math.max(p.z - CELL * 2, Math.min(p.z + CELL * 2, q.z))
    const minX = Math.floor(Math.min(p.x, moveX) / CELL)
    const minY = Math.floor(Math.min(p.y, moveY) / CELL)
    const minZ = Math.floor(Math.min(p.z, moveZ) / CELL)
    const maxX = Math.floor(Math.max(p.x, moveX) / CELL)
    const maxY = Math.floor(Math.max(p.y, moveY) / CELL)
    const maxZ = Math.floor(Math.max(p.z, moveZ) / CELL)
    const serial = ++this.serial
    for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) for (let z = minZ; z <= maxZ; z++) {
      const faces = this.cells.get(key(x, y, z))
      if (!faces) continue
      for (const face of faces) {
        if (face.visited === serial) continue
        face.visited = serial
        if (boxPairOnly && !this.boxPair(layer, face.layer)) continue
        if (face.layer === layer && (!layer.folding || (row >= face.row - 1 && row <= face.row + 2
          && column >= face.column - 1 && column <= face.column + 2))) continue
        if (this.resolveFace(layer, point, face)) return
      }
    }
  }

  private resolveFace(layer: ContactLayer, point: PaperPoint, face: Face): boolean {
    const a = face.a.position
    const b = face.b.position
    const c = face.c.position
    const ab = this.edgeA.subVectors(b, a)
    const ac = this.edgeB.subVectors(c, a)
    const normal = this.normal.crossVectors(ab, ac)
    const area = normal.lengthSq()
    if (area < 1e-9) return false
    normal.multiplyScalar(1 / Math.sqrt(area))
    const relative = this.relative.subVectors(point.position, a)
    const distance = normal.dot(relative)
    this.prior.subVectors(this.oldPosition(point), this.oldPosition(face.a))
    const old = this.priorDistance(point, face)
    const crossed = old * distance < 0 && Math.abs(old) >= LAYER_GAP
    if (Math.abs(distance) > (crossed ? 0.39 : 0.18)) return false
    const side = Math.sign(Math.abs(old) > 0.002 ? old : distance) || 1
    if (distance * side >= LAYER_GAP) return false

    const contact = this.hit.copy(relative)
    let contactArea = area
    if (old * distance < 0 && this.boxPair(layer, face.layer)) {
      contactArea = this.sweepContact(point, face, old, distance)
      if (contactArea < 1e-9) return false
    } else if (old * distance < 0 && Math.abs(distance) > LAYER_GAP) {
      contact.lerp(this.prior, Math.min(1, Math.abs(distance) / Math.abs(distance - old)))
    }
    const uu = ab.lengthSq()
    const vv = ac.lengthSq()
    const uv = ab.dot(ac)
    const hu = contact.dot(ab)
    const hv = contact.dot(ac)
    const wb = (hu * vv - hv * uv) / contactArea
    const wc = (hv * uu - hu * uv) / contactArea
    if (1 - wb - wc < -0.045 || wb < -0.045 || wc < -0.045) return false

    const normalTravel = this.normalMotion(point, normal)
    const wake = face.layer.sleeping && Math.abs(normalTravel) > 0.024 && (Math.abs(old - distance) > 0.016 || distance * side < -0.004)
    const limit = layer === face.layer ? 0.025 : crossed ? 0.41 : 0.091
    this.respond(layer, point, face, side, Math.min(limit, LAYER_GAP - side * distance), wb, wc, wake)
    return true
  }

  private sweepContact(point: PaperPoint, face: Face, old: number, current: number) {
    const startA = this.oldPosition(face.a)
    const startB = this.oldPosition(face.b)
    const startC = this.oldPosition(face.c)
    const from = this.oldPosition(point)
    let low = 0
    let high = 1
    let time = old / (old - current)
    // Evaluate all four moving vertices in the same time slice.
    for (let pass = 0; pass < 5; pass++) {
      const a = this.sweepOrigin.copy(startA).lerp(face.a.position, time)
      this.edgeA.copy(startB).lerp(face.b.position, time).sub(a)
      this.edgeB.copy(startC).lerp(face.c.position, time).sub(a)
      this.hit.copy(from).lerp(point.position, time).sub(a)
      this.oldNormal.crossVectors(this.edgeA, this.edgeB)
      const distance = this.oldNormal.dot(this.hit)
      if (Math.abs(distance) < 1e-7) break
      if (distance * old > 0) low = time
      else high = time
      time = (low + high) * 0.5
    }
    return this.oldNormal.lengthSq()
  }

  private priorDistance(point: PaperPoint, face: Face) {
    const a = this.oldPosition(face.a)
    const normal = this.oldNormal.subVectors(this.oldPosition(face.b), a)
      .cross(this.oldEdge.subVectors(this.oldPosition(face.c), a))
    const area = normal.lengthSq()
    if (area < 1e-9 || normal.dot(this.normal) < 0) normal.copy(this.normal)
    else normal.multiplyScalar(1 / Math.sqrt(area))
    return normal.dot(this.oldEdge.subVectors(this.oldPosition(point), a))
  }

  private respond(layer: ContactLayer, point: PaperPoint, face: Face, side: number, depth: number, wb: number, wc: number, wake: boolean, edge = false) {
    const wa = Math.max(0, 1 - wb - wc)
    wb = Math.max(0, wb)
    wc = Math.max(0, wc)
    const fixed = face.layer.sleeping && (edge || !wake) ? 7 : face.fixed
    const sa = fixed & 1 ? 0 : wa
    const sb = fixed & 2 ? 0 : wb
    const sc = fixed & 4 ? 0 : wc
    const inverseMass = 1 + sa * sa + sb * sb + sc * sc
    const normal = this.normal
    const motion = this.motion.subVectors(point.position, point.previous)
    motion.addScaledVector(this.relative.subVectors(face.a.position, face.a.previous), -wa)
    motion.addScaledVector(this.relative.subVectors(face.b.position, face.b.previous), -wb)
    motion.addScaledVector(this.relative.subVectors(face.c.position, face.c.previous), -wc)
    const normalTravel = motion.dot(normal)
    const closing = Math.min(0, side * normalTravel) / inverseMass
    const response = depth / inverseMass
    if (this.boxPair(layer, face.layer)) this.meetsBoxPaper = true
    const delta = this.correction.copy(normal).multiplyScalar(side * response)
    const previousDelta = this.prior.copy(delta).addScaledVector(normal, side * closing)
    if (layer !== face.layer && (layer.driven || face.layer.driven) && fixed !== 7) {
      // Dry paper slides once tangential motion exceeds what the contact can support.
      const friction = this.friction.copy(motion).addScaledVector(normal, -normalTravel)
        .multiplyScalar(1 / inverseMass).clampLength(0, (response - closing) * 0.28)
      previousDelta.add(friction)
      friction.addScaledVector(normal, side * (closing - response))
      if (layer.driven && (sa || sb || sc)) face.layer.receivePull?.(friction)
      if (face.layer.driven) layer.receivePull?.(friction.negate())
    }
    point.position.add(delta)
    point.previous.add(previousDelta)
    this.shift(face.a, delta, previousDelta, sa)
    this.shift(face.b, delta, previousDelta, sb)
    this.shift(face.c, delta, previousDelta, sc)
    if (wake) face.layer.wake?.()
  }

  private normalMotion(point: PaperPoint, normal: Vector3) {
    return normal.dot(this.relative.subVectors(point.position, point.previous))
  }

  private shift(point: PaperPoint, delta: Vector3, previousDelta: Vector3, weight: number) {
    if (!weight) return
    point.position.addScaledVector(delta, -weight)
    point.previous.addScaledVector(previousDelta, -weight)
  }
}
