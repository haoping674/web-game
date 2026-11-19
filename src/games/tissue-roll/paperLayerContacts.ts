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
  private readonly candidates: ContactLayer[] = []
  private readonly lastSolved = new WeakMap<PaperPoint, Vector3>()
  private serial = 0

  solve(layers: ContactLayer[]) {
    this.cells.clear()
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
      this.index(layer)
    }
    for (const layer of visible) {
      if (layer.sleeping) continue
      for (let r = layer.anchored ? 1 : 0; r < layer.rows.length; r++) {
        const row = layer.rows[r]
        for (let c = 0; c < row.points.length; c++) this.resolvePoint(layer, row.points[c], r, c)
      }
    }
    for (const layer of visible) {
      if (layer.sleeping) continue
      for (let r = 0; r < layer.rows.length; r++) {
        const row = layer.rows[r].points
        const next = layer.rows[r + 1]?.points
        const pinned = layer.anchored && r === 0
        for (let c = 0; c < row.length; c++) {
          if (!pinned && row[c + 1]) this.resolveEdge(layer, row[c], row[c + 1], r, c, false)
          if (next) {
            this.resolveEdge(layer, row[c], next[c], r, c, pinned)
            if (row[c + 1]) this.resolveEdge(layer, row[c + 1], next[c], r, c, pinned)
          }
        }
      }
    }
    for (const layer of layers) if (!layer.sleeping) {
      for (const { points } of layer.rows) for (const point of points) {
        const saved = this.lastSolved.get(point)
        if (saved) saved.copy(point.position)
        else this.lastSolved.set(point, point.position.clone())
      }
    }
  }

  private oldPosition(point: PaperPoint): Vector3 {
    return this.lastSolved.get(point) ?? point.previous
  }

  private resolveEdge(layer: ContactLayer, start: PaperPoint, end: PaperPoint, row: number, column: number, pinned: boolean) {
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
        if (face.layer === layer && (!layer.folding || (row >= face.row - 1 && row <= face.row + 2
          && column >= face.column - 1 && column <= face.column + 2))) continue
        if (this.separateCrossing(start, end, face, pinned)) return
      }
    }
  }

  private separateCrossing(start: PaperPoint, end: PaperPoint, face: Face, pinned: boolean): boolean {
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

    const oldFace = this.oldPosition(face.a)
    const old0 = normal.dot(this.prior.subVectors(this.oldPosition(start), oldFace))
    const old1 = normal.dot(this.prior.subVectors(this.oldPosition(end), oldFace))
    const remembered = old0 * old1 > 0 ? old0 + old1 : Math.abs(d0) > Math.abs(d1) ? d0 : d1
    const side = Math.sign(pinned ? d0 : remembered)
    const point = side * d0 < 0 ? start : end
    const distance = point === start ? d0 : d1
    const normalTravel = this.normalMotion(point, normal)
    const faceTravel = (1 - wb - wc) * this.normalMotion(face.a, normal)
      + wb * this.normalMotion(face.b, normal) + wc * this.normalMotion(face.c, normal)
    const closing = Math.min(0, side * (normalTravel - faceTravel))
    const delta = this.correction.copy(normal).multiplyScalar(side * LAYER_GAP - distance)
    point.position.add(delta)
    point.previous.add(delta).addScaledVector(normal, side * closing)
    if (face.layer.sleeping && Math.abs(normalTravel) > 0.025 && old0 * old1 > 0 && Math.abs(distance) > LAYER_GAP * 2) face.layer.wake?.()
    return true
  }

  private overlap(a: Box3, b: Box3) {
    return a.min.x <= b.max.x + LAYER_GAP && a.max.x >= b.min.x - LAYER_GAP
      && a.min.y <= b.max.y + LAYER_GAP && a.max.y >= b.min.y - LAYER_GAP
      && a.min.z <= b.max.z + LAYER_GAP && a.max.z >= b.min.z - LAYER_GAP
  }

  private index(layer: ContactLayer) {
    for (let r = 0; r < layer.rows.length - 1; r++) {
      const top = layer.rows[r].points
      const below = layer.rows[r + 1].points
      const fixed = r === 0 && layer.anchored
      for (let c = 0; c < COLUMNS - 1; c++) {
        this.insert({ layer, row: r, column: c, a: top[c], b: below[c], c: top[c + 1], fixed: fixed ? 5 : 0, visited: 0 })
        this.insert({ layer, row: r, column: c, a: top[c + 1], b: below[c], c: below[c + 1], fixed: fixed ? 1 : 0, visited: 0 })
      }
    }
  }

  private insert(face: Face) {
    const { position: a } = face.a
    const { position: b } = face.b
    const { position: c } = face.c
    const minX = Math.floor((Math.min(a.x, b.x, c.x) - LAYER_GAP) / CELL)
    const minY = Math.floor((Math.min(a.y, b.y, c.y) - LAYER_GAP) / CELL)
    const minZ = Math.floor((Math.min(a.z, b.z, c.z) - LAYER_GAP) / CELL)
    const maxX = Math.floor((Math.max(a.x, b.x, c.x) + LAYER_GAP) / CELL)
    const maxY = Math.floor((Math.max(a.y, b.y, c.y) + LAYER_GAP) / CELL)
    const maxZ = Math.floor((Math.max(a.z, b.z, c.z) + LAYER_GAP) / CELL)
    for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) for (let z = minZ; z <= maxZ; z++) {
      const id = key(x, y, z)
      const bucket = this.cells.get(id)
      if (bucket) bucket.push(face)
      else this.cells.set(id, [face])
    }
  }

  private resolvePoint(layer: ContactLayer, point: PaperPoint, row: number, column: number) {
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
        if (face.layer === layer && (!layer.folding || (row >= face.row - 1 && row <= face.row + 2
          && column >= face.column - 1 && column <= face.column + 2))) continue
        if (this.resolveFace(point, face)) return
      }
    }
  }

  private resolveFace(point: PaperPoint, face: Face): boolean {
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
    const old = normal.dot(this.prior.subVectors(this.oldPosition(point), this.oldPosition(face.a)))
    const crossed = old * distance < 0 && Math.abs(old) >= LAYER_GAP
    if (Math.abs(distance) > (crossed ? 0.39 : 0.18)) return false
    const side = Math.sign(Math.abs(old) > 0.002 ? old : distance) || 1
    if (distance * side >= LAYER_GAP) return false

    const contact = this.hit.copy(relative)
    if (old * distance < 0 && Math.abs(distance) > LAYER_GAP) {
      contact.lerp(this.prior, Math.min(1, Math.abs(distance) / Math.abs(distance - old)))
    }
    const uu = ab.lengthSq()
    const vv = ac.lengthSq()
    const uv = ab.dot(ac)
    const hu = contact.dot(ab)
    const hv = contact.dot(ac)
    const wb = (hu * vv - hv * uv) / area
    const wc = (hv * uu - hu * uv) / area
    const wa = 1 - wb - wc
    if (wa < -0.045 || wb < -0.045 || wc < -0.045) return false

    const normalTravel = this.normalMotion(point, normal)
    const wake = face.layer.sleeping && Math.abs(normalTravel) > 0.024 && (Math.abs(old - distance) > 0.016 || distance * side < -0.004)
    const fixed = face.layer.sleeping && !wake ? 7 : face.fixed
    const sa = fixed & 1 ? 0 : Math.max(0, wa)
    const sb = fixed & 2 ? 0 : Math.max(0, wb)
    const sc = fixed & 4 ? 0 : Math.max(0, wc)
    const inverseMass = 1 + sa * sa + sb * sb + sc * sc
    const faceTravel = wa * this.normalMotion(face.a, normal)
      + wb * this.normalMotion(face.b, normal) + wc * this.normalMotion(face.c, normal)
    const closing = Math.min(0, side * (normalTravel - faceTravel)) / inverseMass
    const response = Math.min(crossed ? 0.41 : 0.091, LAYER_GAP - side * distance) / inverseMass
    const delta = this.correction.copy(normal).multiplyScalar(side * response)
    const previousDelta = this.prior.copy(delta).addScaledVector(normal, side * closing)
    point.position.add(delta)
    point.previous.add(previousDelta)
    this.shift(face.a, delta, previousDelta, sa)
    this.shift(face.b, delta, previousDelta, sb)
    this.shift(face.c, delta, previousDelta, sc)
    if (wake) face.layer.wake?.()
    return true
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
