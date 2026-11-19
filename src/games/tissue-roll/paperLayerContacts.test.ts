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
        previous: new Vector3(0.65, r === 0 ? 0.20 : 0.08, 0.045 + c * 0.014),
      })),
    }))
    const edge = { rows, bounds: paperBounds(rows, new Box3(), true), anchored: false, sleeping: false }
    new PaperLayerContacts().solve([edge, support])
    expect(rows[1].points.every(({ position }) => position.y >= LAYER_GAP - 1e-6)).toBe(true)
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
