import { describe, expect, it, vi } from 'vitest'
import { randomInitialLength, judgeLength, PX_PER_CM } from './model'

describe('drag length judging', () => {
  it('randomizes initial length within the available rail', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0)
    expect(randomInitialLength(8)).toBe(1.2)
    random.mockReturnValue(.999)
    expect(randomInitialLength(5)).toBe(4.25)
    random.mockRestore()
    expect(PX_PER_CM * 2.54).toBeCloseTo(96)
  })
  it('judges the same rounded centimeters that the result displays', () => {
    expect(judgeLength(3, 3.004)).toMatchObject({ guess: 3, delta: 0, errorBp: 0, score: 1000 })
    expect(judgeLength(3, 3.015)).toMatchObject({ guess: 3.02, delta: .02, errorBp: 67, tier: 'perfect' })
    expect(judgeLength(5, 5.25)).toMatchObject({ errorBp: 500, delta: .25, tier: 'great', score: 900 })
    expect(judgeLength(1, .95)).toMatchObject({ errorBp: 500, delta: -.05, tier: 'great', score: 900 })
    expect(judgeLength(1, 8).score).toBe(0)
  })
  it.each([[.01, 'perfect'], [.02, 'excellent'], [.03, 'excellent'], [.04, 'great'], [.06, 'great'], [.07, 'close'], [.1, 'close'], [.11, 'retry']] as const)('evaluates %s cm error against 1 cm as %s', (error, tier) => {
    expect(judgeLength(1, 1 + error).tier).toBe(tier)
  })
})
