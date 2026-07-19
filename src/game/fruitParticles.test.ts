import { describe, expect, it } from 'vitest'
import { createFruitParticles, fruitParticlePresets, PARTICLE_BUDGET, type FruitRemovedEvent } from './fruitParticles'

const event = (combo = 1, count = 2): FruitRemovedEvent => ({
  fruits: Array.from({ length: count }, (_, index) => ({ id: `0-${index}`, type: index % 2 === 0 ? 'apple' : 'citrus', centerX: 24 + index * 36, centerY: 40, width: 28, height: 28 })),
  combo,
  tier: combo >= 20 ? 'orchard' : combo >= 10 ? 'legendary' : 'base',
  milestone: combo === 5 || combo === 10 || combo === 20,
})

describe('fruit particle factory', () => {
  it('maps existing fruit themes to distinct presets and preserves each origin', () => {
    expect(fruitParticlePresets.apple.colors).not.toEqual(fruitParticlePresets.citrus.colors)
    const particles = createFruitParticles(event(), 'full')
    expect(particles.some((particle) => particle.x < 45)).toBe(true)
    expect(particles.some((particle) => particle.x > 45)).toBe(true)
  })

  it('caps large clears and plateaus Combo 20 particle complexity', () => {
    expect(createFruitParticles(event(20, 20), 'full').length).toBeLessThanOrEqual(PARTICLE_BUDGET.maxPerClear)
    expect(createFruitParticles(event(20), 'full').length).toBe(createFruitParticles(event(80), 'full').length)
  })

  it('reduces low-stimulation effects to one color-matched particle per fruit', () => {
    const particles = createFruitParticles(event(12, 4), 'minimal')
    expect(particles).toHaveLength(4)
    expect(particles.every((particle) => particle.shape === 'circle')).toBe(true)
  })

  it('does not emit particles for an empty removal event', () => {
    expect(createFruitParticles({ ...event(), fruits: [] }, 'full')).toEqual([])
  })
})
