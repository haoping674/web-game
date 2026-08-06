import { describe, expect, it } from 'vitest'
import { getNumberPathLevel, NUMBER_PATH_LEVELS } from './levels'
import { isCorrectNextPosition } from './rules'
import { solveNumberPath } from './solver'

function levelAt(index: number) {
  const level = NUMBER_PATH_LEVELS[index]
  if (!level) throw new Error(`Missing preset level at ${index}`)
  return level
}

describe('Number Path fixed-answer rules', () => {
  it('keeps every preset answer complete, non-repeating, and solver-verified', () => {
    NUMBER_PATH_LEVELS.forEach((level) => {
      const playableCells = level.cells.filter((cell) => !cell.blocked)
      expect(playableCells).toHaveLength(level.maxNumber)
      expect(new Set(playableCells.map((cell) => cell.value)).size).toBe(level.maxNumber)
      expect(playableCells.map((cell) => cell.value).sort((left, right) => left - right)).toEqual(
        Array.from({ length: level.maxNumber }, (_, index) => index + 1),
      )
      const result = solveNumberPath(level, { maxSolutions: 2, maxNodes: 80_000 })
      expect(result.stoppedEarly).toBe(false)
      expect(result.solutions).toHaveLength(1)
    })
  })

  it('requires 1 first, then only an orthogonally adjacent N + 1', () => {
    const level = levelAt(0)
    const one = level.cells.find((cell) => cell.value === 1)
    const two = level.cells.find((cell) => cell.value === 2)
    const three = level.cells.find((cell) => cell.value === 3)
    if (!one || !two || !three) throw new Error('Fixture level is incomplete')
    expect(isCorrectNextPosition(level, [], { row: one.row, column: one.column })).toBe(true)
    expect(isCorrectNextPosition(level, [], { row: two.row, column: two.column })).toBe(false)
    expect(isCorrectNextPosition(level, [{ row: one.row, column: one.column }], { row: two.row, column: two.column })).toBe(true)
    expect(isCorrectNextPosition(level, [{ row: one.row, column: one.column }], { row: three.row, column: three.column })).toBe(false)
  })

  it('keeps a route addressable independently from every other game route', () => {
    expect(getNumberPathLevel('path-hard-02')?.difficulty).toBe('hard')
    expect(getNumberPathLevel('path-hard-03')?.cells.filter((cell) => cell.blocked)).toHaveLength(2)
    expect(getNumberPathLevel('not-a-level')).toBeUndefined()
  })
})
