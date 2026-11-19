import { describe, expect, it } from 'vitest'
import { Vector3 } from 'three'
import { PaperLayerContacts } from './paperLayerContacts'

function sheet(z: number) {
  return Array.from({ length: 7 }, (_, row) => ({
    id: row,
    points: Array.from({ length: 5 }, (_, column) => {
      const position = new Vector3(column * 0.12, row * 0.10, z)
      return { position, previous: position.clone() }
    }),
  }))
}

describe('lightweight paper contact', () => {
  it('pushes the loose part of the box sheet while leaving the grip and slot in place', () => {
    const attached = sheet(0)
    const held = sheet(0.10)
    new PaperLayerContacts().touch(attached, held)
    expect(attached[3].points[2].position.z).toBeLessThan(0)
    expect(attached[3].points[2].position.z).toBeGreaterThanOrEqual(-0.036)
    expect(attached[0].points[2].position.z).toBe(0)
    expect(held[3].points[2].position.z).toBe(0.10)
  })

  it('leaves the box sheet still when the held paper is out of range', () => {
    const attached = sheet(0)
    new PaperLayerContacts().touch(attached, sheet(0.35))
    expect(attached.every(({ points }) => points.every(({ position }) => position.z === 0))).toBe(true)
  })
})
