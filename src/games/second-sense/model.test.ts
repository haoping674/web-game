import { describe, expect, it } from 'vitest'
import { judgeTiming, TARGETS } from './model'

describe('Second Sense judging', () => {
  it.each(TARGETS)('judges an exact %i second round and preserves signed millisecond errors', (target) => {
    expect(judgeTiming(target * 1000, target)).toMatchObject({ delta: 0, error: 0, score: 1000, tier: 'perfect' })
    expect(judgeTiming(target * 1000 - 81, target)).toMatchObject({ delta: -81, error: 81, tier: 'great' })
    expect(judgeTiming(target * 1000 + 81, target)).toMatchObject({ delta: 81, error: 81, tier: 'great' })
  })
  it.each([[30, 'perfect'], [31, 'excellent'], [80, 'excellent'], [81, 'great'], [150, 'great'], [151, 'close'], [300, 'close'], [301, 'retry']] as const)('assigns %i ms to %s feedback', (error, tier) => {
    expect(judgeTiming(3000 + error, 3).tier).toBe(tier)
  })
  it('rounds once to the displayed millisecond and never returns negative scores', () => {
    expect(judgeTiming(3029.6, 3)).toMatchObject({ elapsed: 3030, error: 30, tier: 'perfect', score: 970 })
    expect(judgeTiming(30_000, 1).score).toBe(0)
  })
})
