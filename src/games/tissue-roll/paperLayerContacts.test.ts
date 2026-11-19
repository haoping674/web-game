import { describe, expect, it } from 'vitest'
import { Box3, Vector3 } from 'three'
import { LAYER_GAP, PaperLayerContacts, paperBounds, type ContactLayer } from './paperLayerContacts'
import { COLUMNS } from './tissueDimensions'

function flatSheet(y: number, previousY = y): ContactLayer {
  const rows = Array.from({ length: 4 }, (_, row) => ({
    id: row,
    points: Array.from({ length: COLUMNS }, (_, col) => ({
      position: new Vector3(col * 0.112 + (y < 0 ? 0.048 : 0), y, row * 0.112 + (y < 0 ? 0.042 : 0)),
      previous: new Vector3(col * 0.112 + (y < 0 ? 0.048 : 0), previousY, row * 0.112 + (y < 0 ? 0.042 : 0)),
    })),
  }))
  return { rows, bounds: paperBounds(rows, new Box3()), anchored: false, sleeping: false }
}

describe('thin paper contacts', () => {
  it('catches a moving face sweeping through held paper between repeated contacts', () => {
    const held = flatSheet(0)
    held.driven = true
    // Isolate a corner: the opposing faces must sweep over this vertex to hit it.
    const corner = held.rows[1].points[7]
    for (const { points } of held.rows) for (const point of points) {
      point.position.set(point === corner ? 0.72 : 3, 0, 0.13)
      point.previous.copy(point.position)
    }
    const contacts = new PaperLayerContacts()
    for (const direction of [1, -1, 1, -1]) {
      const boxPaper = flatSheet(0)
      boxPaper.anchored = true
      for (const { points } of boxPaper.rows) for (const point of points) {
        point.previous.y = 0.27 * direction
        point.position.y = -0.27 * direction
      }
      for (const { points } of held.rows) for (const point of points) {
        point.position.y = 0
        point.previous.y = 0
      }
      paperBounds(held.rows, held.bounds, true)
      paperBounds(boxPaper.rows, boxPaper.bounds, true)
      contacts.solve([held, boxPaper])
      expect(corner.position.y * direction).toBeLessThan(-0.10)
    }
  })

  it('uses the last contact step when a sheet crosses between collision checks', () => {
    const falling = flatSheet(0.20)
    const support = flatSheet(0)
    support.sleeping = true
    let woken = false
    support.wake = () => { woken = true }
    const contacts = new PaperLayerContacts()
    contacts.solve([falling, support])
    for (const { points } of falling.rows) for (const point of points) {
      point.position.y = -0.10
      point.previous.y = -0.07
    }
    paperBounds(falling.rows, falling.bounds, true)
    contacts.solve([falling, support])
    expect(woken).toBe(true)
    expect(falling.rows[1].points[7].position.y).toBeGreaterThan(-0.06)
  })

  it('separates a paper edge that crosses a sheet with both endpoints outside contact range', () => {
    const support = flatSheet(0)
    support.sleeping = true
    const rows = Array.from({ length: 2 }, (_, r) => ({
      id: r,
      points: Array.from({ length: COLUMNS }, (_, c) => ({
        position: new Vector3(0.65, r === 0 ? 0.42 : -0.42, 0.045 + c * 0.014),
        previous: new Vector3(0.63, r === 0 ? 0.20 : 0.08, 0.045 + c * 0.014),
      })),
    }))
    const edge = { rows, bounds: paperBounds(rows, new Box3(), true), anchored: false, sleeping: false }
    new PaperLayerContacts().solve([edge, support])
    expect(rows[1].points.every(({ position }) => position.y >= LAYER_GAP - 1e-6)).toBe(true)
    for (const { position, previous } of rows[1].points) {
      expect(position.y - previous.y).toBeCloseTo(0, 6)
      expect(position.x - previous.x).toBeCloseTo(0.02, 6)
    }
  })

  it('stops a paper vertex moving through the face of another sheet and wakes the struck sheet', () => {
    const falling = flatSheet(-0.008, 0.042)
    const support = flatSheet(0)
    support.sleeping = true
    let woken = false
    support.wake = () => { woken = true }
    const contacts = new PaperLayerContacts()
    contacts.solve([falling, support])
    expect(woken).toBe(true)
    expect(falling.rows[1].points[7].position.y).toBeGreaterThan(0)
    expect(support.rows[1].points[7].position.y).toBeLessThan(-LAYER_GAP / 6)
  })
})
