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

export function paperBounds(rows: PaperRow[], out: Box3): Box3 {
  out.makeEmpty()
  for (const { points } of rows) for (const point of points) out.expandByPoint(point.position)
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
  private serial = 0

  solve(layers: ContactLayer[]) {
    this.cells.clear()
    const visible = this.candidates
    visible.length = 0
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
    const q = point.previous
    const moveX = Math.max(p.x - CELL, Math.min(p.x + CELL, q.x))
    const moveY = Math.max(p.y - CELL, Math.min(p.y + CELL, q.y))
    const moveZ = Math.max(p.z - CELL, Math.min(p.z + CELL, q.z))
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
    if (Math.abs(distance) > 0.18) return false
    const old = normal.dot(this.prior.subVectors(point.previous, face.a.previous))
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

    const wake = face.layer.sleeping && (Math.abs(old - distance) > 0.016 || distance * side < -0.004)
    const fixed = face.layer.sleeping && !wake ? 7 : face.fixed
    const sa = fixed & 1 ? 0 : Math.max(0, wa)
    const sb = fixed & 2 ? 0 : Math.max(0, wb)
    const sc = fixed & 4 ? 0 : Math.max(0, wc)
    const response = Math.min(0.091, LAYER_GAP - side * distance) / (1 + sa * sa + sb * sb + sc * sc)
    const delta = this.correction.copy(normal).multiplyScalar(side * response)
    point.position.add(delta)
    point.previous.addScaledVector(delta, 0.78)
    this.shift(face.a, delta, sa)
    this.shift(face.b, delta, sb)
    this.shift(face.c, delta, sc)
    if (wake) face.layer.wake?.()
    return true
  }

  private shift(point: PaperPoint, delta: Vector3, weight: number) {
    if (!weight) return
    point.position.addScaledVector(delta, -weight)
    point.previous.addScaledVector(delta, -weight * 0.78)
  }
}
