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
