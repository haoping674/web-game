// @vitest-environment jsdom
import { act, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ComboClearEffect } from '../game/comboEffects'
import { getDeviceEffectScale, MAX_PARTICLES } from '../game/effectPerformance'
import { ParticleLayer } from './ParticleLayer'

const effect = (id: number, tier: ComboClearEffect['tier'] = 'legendary'): ComboClearEffect & { x: number; y: number } => ({
  id,
  rect: { start: { row: 0, column: 0 }, end: { row: 0, column: 1 } },
  combo: 12,
  tier,
  rating: 'Fruit Flow',
  milestone: false,
  points: 2,
  durationMs: 400,
  particleScale: 1,
  burstScale: 1,
  x: 50,
  y: 50,
})

describe('ParticleLayer', () => {
  it('caps particles during rapid clears and removes every completed burst', () => {
    vi.useFakeTimers()
    const { container, rerender } = render(<ParticleLayer effect={effect(1)} level="full" />)
    for (let id = 2; id <= 8; id += 1) rerender(<ParticleLayer effect={effect(id)} level="full" />)
    expect(container.querySelectorAll('.combo-burst>i').length).toBeLessThanOrEqual(MAX_PARTICLES)
    act(() => vi.runAllTimers())
    expect(container.querySelector('.particle-layer')).toBeNull()
    vi.useRealTimers()
  })

  it('deduplicates repeated effect ids and scales down low-end devices', () => {
    vi.useFakeTimers()
    const { container, rerender } = render(<ParticleLayer effect={effect(1)} level="full" />)
    rerender(<ParticleLayer effect={effect(1)} level="full" />)
    expect(container.querySelectorAll('.combo-burst')).toHaveLength(1)
    const particleCount = container.querySelectorAll('.combo-burst>i').length
    expect(particleCount).toBeGreaterThan(0)
    expect(particleCount).toBeLessThanOrEqual(22)
    expect(getDeviceEffectScale({ hardwareConcurrency: 2, deviceMemory: 8 })).toBe(0.55)
    expect(getDeviceEffectScale({ hardwareConcurrency: 8, deviceMemory: 8 })).toBe(1)
    act(() => vi.runAllTimers())
    expect(container.querySelector('.particle-layer')).toBeNull()
    rerender(<ParticleLayer effect={effect(1)} level="full" />)
    expect(container.querySelector('.particle-layer')).toBeNull()
    vi.useRealTimers()
  })

  it('keeps only the simple score feedback in minimal mode', () => {
    const { container } = render(<ParticleLayer effect={effect(1)} level="minimal" />)
    expect(container.querySelectorAll('.combo-burst>i')).toHaveLength(0)
    expect(container.querySelector('.harvest-core')).toBeNull()
    expect(container.querySelector('.combo-ring')).toBeNull()
    expect(container.querySelector('.score-pop')).not.toBeNull()
  })

  it('shows a restrained harvest burst from the first Combo', () => {
    const { container } = render(<ParticleLayer effect={effect(1, 'base')} level="full" />)
    const particleCount = container.querySelectorAll('.combo-burst>i').length
    expect(particleCount).toBeGreaterThan(0)
    expect(particleCount).toBeLessThanOrEqual(6)
    expect(container.querySelector('.harvest-core')).not.toBeNull()
    expect(container.querySelector('.combo-ring')).toBeNull()
  })
})
