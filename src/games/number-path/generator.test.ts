import { describe, expect, it } from 'vitest'
import { generatePracticeLevel } from './generator'
import { solveNumberPath } from './solver'
import type { NumberPathDifficulty } from './types'

describe('Number Path practice generator', () => {
  it.each([
    ['easy', 101],
    ['normal', 202],
    ['hard', 303],
  ] as const satisfies readonly [NumberPathDifficulty, number][])('builds a solver-verified %s route', (difficulty, seed) => {
    const level = generatePracticeLevel(difficulty, seed)
    const playableCells = level.cells.filter((cell) => !cell.blocked)
    const result = solveNumberPath(level, { maxSolutions: 2, maxNodes: 80_000 })

    expect(level.id).toContain(`practice-${difficulty}-${seed}`)
    expect(playableCells).toHaveLength(level.maxNumber)
    expect(playableCells.map((cell) => cell.value).sort((left, right) => left - right)).toEqual(
      Array.from({ length: level.maxNumber }, (_, index) => index + 1),
    )
    expect(result.stoppedEarly).toBe(false)
    expect(result.solutions).toHaveLength(1)
  })

  it('returns the same route for the same seed', () => {
    const first = generatePracticeLevel('normal', 777)
    const second = generatePracticeLevel('normal', 777)
    expect(first).toEqual(second)
  })
})
