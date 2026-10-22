import { describe, expect, it } from 'vitest'
import { randomSenseTarget } from './randomSenseTarget'

describe('feeling game random targets', () => {
  it('covers 1.0 to 5.0 with equally spaced tenths and inclusive endpoints', () => {
    expect(randomSenseTarget(() => 0)).toBe(1)
    expect(randomSenseTarget(() => 1)).toBe(5)
    expect(randomSenseTarget(() => .3)).toBe(2.2)
    const targets = Array.from({ length: 41 }, (_, index) => randomSenseTarget(() => (index + .5) / 41))
    expect(targets).toEqual(Array.from({ length: 41 }, (_, index) => (10 + index) / 10))
  })
})
