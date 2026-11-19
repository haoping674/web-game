import { Box3, Vector3 } from 'three'
import { type PaperRow } from './tissueDimensions'

const TOUCH_RADIUS = 0.21
const TOUCH_RADIUS_SQUARED = TOUCH_RADIUS * TOUCH_RADIUS

export function paperBounds(rows: PaperRow[], out: Box3): Box3 {
  out.makeEmpty()
  for (const { points } of rows) for (const { position } of points) out.expandByPoint(position)
  return out
}

/** A light push on the exposed sheet. The held sheet remains under pointer control. */
export class PaperLayerContacts {
  private readonly bounds = new Box3()
  private readonly samples: Vector3[] = []
  private readonly push = new Vector3()

  touch(attached: PaperRow[], held: PaperRow[]) {
    const bounds = paperBounds(attached, this.bounds).expandByScalar(TOUCH_RADIUS)
    const samples = this.samples
    samples.length = 0
    for (let r = 0; r < held.length; r += 3) {
      const { points } = held[r]
      for (let c = 0; c < points.length; c += 2) {
        const { position } = points[c]
        if (bounds.containsPoint(position)) samples.push(position)
      }
    }
    if (!samples.length) return 0

    // Only the exposed strip can move. Leave the row fed through the slit pinned.
    let strongest = 0
    for (let r = 1; r < attached.length; r++) {
      for (const point of attached[r].points) {
        let nearest: Vector3 | undefined
        let distanceSquared = TOUCH_RADIUS_SQUARED
        for (const sample of samples) {
          const candidate = point.position.distanceToSquared(sample)
          if (candidate >= distanceSquared) continue
          distanceSquared = candidate
          nearest = sample
        }
        if (!nearest) continue
        const distance = Math.sqrt(distanceSquared)
        const push = this.push.subVectors(point.position, nearest)
        if (distance > 0.00001) push.multiplyScalar(1 / distance)
        else push.set(0, 0, -1)
        const strength = Math.min(0.036, (TOUCH_RADIUS - distance) * 0.27)
        strongest = Math.max(strongest, strength)
        push.multiplyScalar(strength)
        point.position.add(push)
        point.previous.addScaledVector(push, 0.8)
      }
    }
    return strongest / 0.036
  }
}
