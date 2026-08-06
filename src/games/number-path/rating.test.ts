import { describe, expect, it } from 'vitest'
import { rateNumberPathCompletion } from './rating'

describe('Number Path completion ratings', () => {
  it('rewards fast, accurate, hint-free routes', () => {
    expect(rateNumberPathCompletion({ difficulty: 'easy', elapsedSeconds: 15, errors: 0, hintsUsed: 0 }).grade).toBe('S')
  })

  it('reduces the grade for errors, hints, and time', () => {
    const clean = rateNumberPathCompletion({ difficulty: 'hard', elapsedSeconds: 70, errors: 0, hintsUsed: 0 })
    const rough = rateNumberPathCompletion({ difficulty: 'hard', elapsedSeconds: 170, errors: 5, hintsUsed: 4 })
    expect(rough.score).toBeLessThan(clean.score)
    expect(rough.grade).toBe('C')
  })
})
