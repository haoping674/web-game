import { Box3, Ray, Triangle, Vector3 } from 'three'
import { type PaperPoint, type PaperRow } from './tissueDimensions'

const CELL = 0.24
const EDGE_MARGIN = 0.0004
const key = (x: number, y: number, z: number) => x + y * 1024 + z * 1048576

type Pose = { point: PaperPoint; start: Vector3; end: Vector3 }
type Face = { triangle: Triangle; visited: number }

/** Keeps the last clear configuration available when the slot and paper constraints conflict. */
export class PaperContactGuard {
  private readonly poses = new WeakMap<PaperPoint, Pose>()
  private readonly box = new Box3()
  private readonly held = new Box3()
  private readonly bounds = new Box3()
  private readonly overlap = new Box3()
  private readonly cells = new Map<number, Face[]>()
  private readonly faces: Face[] = []
  private readonly ray = new Ray()
  private readonly hit = new Vector3()
  private usedFaces = 0
  private serial = 0

  capture(box: PaperRow[], held: PaperRow[]) {
    for (const rows of [box, held]) for (const { points } of rows) for (const point of points) {
      const pose = this.poses.get(point)
      if (pose) pose.start.copy(point.position)
      else this.poses.set(point, { point, start: point.position.clone(), end: new Vector3() })
    }
  }

  separate(box: PaperRow[], held: PaperRow[]): boolean {
    if (!this.intersect(box, held)) return false
    const movable: Pose[] = []
    for (const rows of [box, held]) for (let r = rows === box ? 1 : 0; r < rows.length; r++) {
      for (const point of rows[r].points) {
        const pose = this.poses.get(point)
        if (!pose) continue
        pose.end.copy(point.position)
        movable.push(pose)
      }
    }
    const setFraction = (amount: number) => {
      for (const { point, start, end } of movable) point.position.copy(start).lerp(end, amount)
    }
    // A fast grip can demand a pose that satisfies the carton or the paper but
    // not both. Retreat only as far as the two triangle meshes need to separate.
    setFraction(0)
    if (this.intersect(box, held)) {
      setFraction(1)
      return false
    }
    let low = 0
    let high = 1
    for (let pass = 0; pass < 5; pass++) {
      const amount = (low + high) / 2
      setFraction(amount)
      if (this.intersect(box, held)) high = amount
      else low = amount
    }
    setFraction(low)
    for (const { point, start } of movable) point.previous.lerpVectors(start, point.previous, low)
    return true
  }

  private intersect(box: PaperRow[], held: PaperRow[]) {
    this.box.makeEmpty()
    this.held.makeEmpty()
    for (const { points } of box) for (const { position } of points) this.box.expandByPoint(position)
    for (const { points } of held) for (const { position } of points) this.held.expandByPoint(position)
    this.overlap.copy(this.box).intersect(this.held)
    return !this.overlap.isEmpty() && (this.hasCrossing(held, box) || this.hasCrossing(box, held))
  }

  private hasCrossing(edges: PaperRow[], faces: PaperRow[]) {
    this.cells.clear()
    this.usedFaces = 0
    for (let row = 1; row < faces.length; row++) {
      const top = faces[row - 1].points
      const below = faces[row].points
      for (let col = 1; col < top.length; col++) {
        this.index(top[col - 1].position, below[col - 1].position, top[col].position)
        this.index(top[col].position, below[col - 1].position, below[col].position)
      }
    }
    for (let row = 0; row < edges.length; row++) {
      const points = edges[row].points
      const below = edges[row + 1]?.points
      for (let col = 0; col < points.length; col++) {
        const p = points[col].position
        if (points[col + 1] && this.cuts(p, points[col + 1].position)) return true
        if (below && (this.cuts(p, below[col].position)
          || (points[col + 1] && this.cuts(points[col + 1].position, below[col].position)))) return true
      }
    }
    return false
  }

  private index(a: Vector3, b: Vector3, c: Vector3) {
    this.bounds.makeEmpty().expandByPoint(a).expandByPoint(b).expandByPoint(c).intersect(this.overlap)
    if (this.bounds.isEmpty()) return
    const slot = this.usedFaces++
    const face = this.faces[slot] ?? (this.faces[slot] = { triangle: new Triangle(), visited: 0 })
    face.triangle.a = a
    face.triangle.b = b
    face.triangle.c = c
    const { min, max } = this.bounds
    for (let x = Math.floor(min.x / CELL); x <= Math.floor(max.x / CELL); x++) {
      for (let y = Math.floor(min.y / CELL); y <= Math.floor(max.y / CELL); y++) {
        for (let z = Math.floor(min.z / CELL); z <= Math.floor(max.z / CELL); z++) {
          const id = key(x, y, z)
          const bucket = this.cells.get(id)
          if (bucket) bucket.push(face)
          else this.cells.set(id, [face])
        }
      }
    }
  }

  private cuts(start: Vector3, end: Vector3) {
    this.bounds.makeEmpty().expandByPoint(start).expandByPoint(end).intersect(this.overlap)
    if (this.bounds.isEmpty()) return false
    const length = this.ray.direction.subVectors(end, start).length()
    if (length <= EDGE_MARGIN * 2) return false
    this.ray.direction.divideScalar(length)
    this.ray.origin.copy(start)
    const { min, max } = this.bounds
    const serial = ++this.serial
    for (let x = Math.floor(min.x / CELL); x <= Math.floor(max.x / CELL); x++) {
      for (let y = Math.floor(min.y / CELL); y <= Math.floor(max.y / CELL); y++) {
        for (let z = Math.floor(min.z / CELL); z <= Math.floor(max.z / CELL); z++) {
          const faces = this.cells.get(key(x, y, z))
          if (!faces) continue
          for (const face of faces) {
            if (face.visited === serial) continue
            face.visited = serial
            const { a, b, c } = face.triangle
            if (!this.ray.intersectTriangle(a, b, c, false, this.hit)) continue
            const distance = this.hit.distanceToSquared(start)
            if (distance > EDGE_MARGIN ** 2 && distance < (length - EDGE_MARGIN) ** 2) return true
          }
        }
      }
    }
    return false
  }
}
