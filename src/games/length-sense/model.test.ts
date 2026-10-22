import { describe, expect, it } from 'vitest'
import { clampLength, judgeLength, randomLength } from './model'

describe('length judging', () => {
  it('creates targets that fit both mobile and desktop rails', () => {
    expect(randomLength(() => 0)).toBe(2500)
    expect(randomLength(() => 1)).toBe(8000)
    expect(randomLength(() => .5)).toBe(5250)
    expect(clampLength(-10)).toBe(500)
    expect(clampLength(11000)).toBe(9500)
    expect(clampLength(5214)).toBe(5210)
  })
  it('judges relative length, giving scaled versions the same result', () => {
    expect(judgeLength(5000, 5250)).toMatchObject({ errorBp: 500, delta: 250, tier: 'great', score: 900 })
    expect(judgeLength(2500, 2625)).toMatchObject({ errorBp: 500, tier: 'great', score: 900 })
    expect(judgeLength(5000, 4750)).toMatchObject({ errorBp: 500, delta: -250, tier: 'great', score: 900 })
    expect(judgeLength(5000, 5000)).toMatchObject({ errorBp: 0, tier: 'perfect', score: 1000 })
    expect(judgeLength(2500, 9500).score).toBe(0)
  })
  it.each([[100, 'perfect'], [102, 'excellent'], [300, 'excellent'], [302, 'great'], [600, 'great'], [602, 'close'], [1000, 'close'], [1002, 'retry']] as const)('evaluates %i basis points as %s', (errorBp, tier) => {
    expect(judgeLength(5000, 5000 + errorBp / 2).tier).toBe(tier)
  })
})
