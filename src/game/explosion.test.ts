import { describe, expect, it } from 'vitest'
import { calculateExplosionGeometry, explosionConfig, getExplosionTierConfig, getParticleKind } from './explosion'

describe('fruit explosion geometry', () => {
  it('uses the geometric center of the actual cleared fruit', () => {
    const geometry = calculateExplosionGeometry(
      { start: { row: 0, column: 0 }, end: { row: 2, column: 4 } },
      [{ row: 0, column: 0 }, { row: 2, column: 4 }],
      10,
      17,
      false,
    )
    expect(geometry.center.x).toBeCloseTo(14.71, 2)
    expect(geometry.center.y).toBe(15)
    expect(geometry.sources).toHaveLength(1)
  })

  it('uses up to four fruit-local sources and maps them in portrait mode', () => {
    const cells = Array.from({ length: 12 }, (_, row) => ({ row, column: 0 }))
    const geometry = calculateExplosionGeometry(
      { start: { row: 0, column: 0 }, end: { row: 9, column: 0 } },
      cells,
      17,
      10,
      true,
    )
    expect(geometry.sources).toHaveLength(4)
    expect(geometry.sources[0]).toEqual({ x: (0.5 / 17) * 100, y: 5 })
    expect(geometry.sources.at(-1)).toEqual({ x: (11.5 / 17) * 100, y: 5 })
  })
})

describe('fruit explosion tiers', () => {
  it('matches each Combo range and caps Combo 20+ at the orchard limit', () => {
    expect(getExplosionTierConfig('base').particleCount).toBeGreaterThanOrEqual(4)
    expect(getExplosionTierConfig('base').particleCount).toBeLessThanOrEqual(6)
    expect(getExplosionTierConfig('rising').particleCount).toBeGreaterThanOrEqual(6)
    expect(getExplosionTierConfig('rising').particleCount).toBeLessThanOrEqual(10)
    expect(getExplosionTierConfig('charged').particleCount).toBeGreaterThanOrEqual(10)
    expect(getExplosionTierConfig('charged').particleCount).toBeLessThanOrEqual(14)
    expect(getExplosionTierConfig('legendary').particleCount).toBeGreaterThanOrEqual(14)
    expect(getExplosionTierConfig('legendary').particleCount).toBeLessThanOrEqual(18)
    expect(explosionConfig.orchard).toEqual(getExplosionTierConfig('orchard'))
  })

  it('adds seed and rind debris only to the higher tiers', () => {
    expect(Array.from({ length: 8 }, (_, index) => getParticleKind(index, 'base'))).not.toContain('rind')
    expect(Array.from({ length: 12 }, (_, index) => getParticleKind(index, 'charged'))).toContain('rind')
  })
})
