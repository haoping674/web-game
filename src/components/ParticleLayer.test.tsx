// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { ComboClearEffect } from '../game/comboEffects'
import { ParticleLayer } from './ParticleLayer'

const effect = (id: number): ComboClearEffect => ({
  id,
  rect: { start: { row: 0, column: 0 }, end: { row: 0, column: 1 } },
  cells: [{ row: 0, column: 0 }, { row: 0, column: 1 }],
  combo: 12,
  tier: 'legendary',
  rating: 'Fruit Flow',
  milestone: false,
  points: 2,
  durationMs: 400,
  particleScale: 1,
  burstScale: 1,
  fruitEvent: {
    fruits: [
      { id: '0-0', type: 'apple', centerX: 30, centerY: 40, width: 24, height: 24 },
      { id: '0-1', type: 'citrus', centerX: 60, centerY: 40, width: 24, height: 24 },
    ],
    combo: 12,
    tier: 'legendary',
    milestone: false,
  },
})

describe('ParticleLayer', () => {
  beforeAll(() => {
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { configurable: true, value: vi.fn(() => null) })
  })

  it('uses one non-interactive canvas and does not create particle DOM nodes', () => {
    const { container } = render(<ParticleLayer effect={effect(1)} level="full" />)
    expect(container.querySelector('.fruit-particle-canvas')).not.toBeNull()
    expect(container.querySelector('.fruit-particle')).toBeNull()
    expect(container.querySelector('.particle-layer')?.getAttribute('data-active-bursts')).toBe('1')
  })

  it('clears its visible burst immediately when effects are disabled or reset', () => {
    const { container, rerender } = render(<ParticleLayer effect={effect(1)} level="full" />)
    expect(container.querySelector('.combo-burst')).not.toBeNull()
    rerender(<ParticleLayer effect={effect(1)} level="off" />)
    expect(container.querySelector('.combo-burst')).toBeNull()
    rerender(<ParticleLayer effect={null} level="full" />)
    expect(container.querySelector('.combo-burst')).toBeNull()
  })
})
