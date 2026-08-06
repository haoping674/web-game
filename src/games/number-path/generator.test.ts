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
    const visibleCells = playableCells.filter((cell) => cell.visible)
    const result = solveNumberPath(level, { maxSolutions: 2, maxNodes: 80_000 })

    expect(level.id).toContain(`practice-${difficulty}-${seed}`)
    expect(playableCells).toHaveLength(level.maxNumber)
    expect(playableCells.map((cell) => cell.value).sort((left, right) => left - right)).toEqual(
      Array.from({ length: level.maxNumber }, (_, index) => index + 1),
    )
    expect(visibleCells.length).toBeGreaterThanOrEqual(Math.ceil(level.maxNumber / 2))
    expect(visibleCells.length).toBeLessThanOrEqual(difficulty === 'easy' ? 10 : difficulty === 'normal' ? 12 : 15)
    expect(result.stoppedEarly).toBe(false)
    expect(result.solutions).toHaveLength(1)
    const solution = result.solutions[0]
    if (!solution) throw new Error('Expected a solver-verified practice solution')
    expect(solution.slice(1).some((position, index) => {
      const previous = solution[index]
      return previous !== undefined && Math.abs(position.row - previous.row) === 1 && Math.abs(position.column - previous.column) === 1
    })).toBe(true)
  })

  it('returns the same route for the same seed', () => {
    const first = generatePracticeLevel('normal', 777)
    const second = generatePracticeLevel('normal', 777)
    expect(first).toEqual(second)
  })

  it.each([
    ['easy', 11], ['easy', 29], ['easy', 47], ['easy', 83],
    ['normal', 11], ['normal', 29], ['normal', 47], ['normal', 83],
    ['hard', 11], ['hard', 29], ['hard', 47], ['hard', 83],
  ] as const satisfies readonly [NumberPathDifficulty, number][])('keeps %s seed %i uniquely solvable with sparse clues', (difficulty, seed) => {
    const level = generatePracticeLevel(difficulty, seed)
    const result = solveNumberPath(level, { maxSolutions: 2, maxNodes: 140_000 })
    const visibleCount = level.cells.filter((cell) => cell.visible).length
    const clueCeiling = difficulty === 'easy' ? 10 : difficulty === 'normal' ? 12 : 15

    expect(visibleCount).toBeLessThanOrEqual(clueCeiling)
    expect(result.stoppedEarly).toBe(false)
    expect(result.solutions).toHaveLength(1)
  })
})
