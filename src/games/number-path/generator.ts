import { buildNumberPathLevel } from './levels'
import { solveNumberPath } from './solver'
import type { NumberPathDifficulty, NumberPathLevel, NumberPathPosition } from './types'

type PracticeSpec = {
  rows: number
  columns: number
  clueStride: number
}

const PRACTICE_SPECS: Record<NumberPathDifficulty, PracticeSpec> = {
  easy: { rows: 4, columns: 4, clueStride: 2 },
  normal: { rows: 4, columns: 5, clueStride: 3 },
  hard: { rows: 5, columns: 5, clueStride: 4 },
}

type Random = () => number

function createRandom(seed: number): Random {
  let state = seed >>> 0
  return () => {
    state += 0x6D2B79F5
    let value = state
    value = Math.imul(value ^ value >>> 15, value | 1)
    value ^= value + Math.imul(value ^ value >>> 7, value | 61)
    return ((value ^ value >>> 14) >>> 0) / 4_294_967_296
  }
}

function positionKey({ row, column }: NumberPathPosition): string {
  return `${row}:${column}`
}

function neighbors(position: NumberPathPosition, rows: number, columns: number): NumberPathPosition[] {
  return [
    { row: position.row - 1, column: position.column },
    { row: position.row, column: position.column + 1 },
    { row: position.row + 1, column: position.column },
    { row: position.row, column: position.column - 1 },
  ].filter((candidate) => candidate.row >= 0 && candidate.row < rows && candidate.column >= 0 && candidate.column < columns)
}

function shuffled<T>(values: readonly T[], random: Random): T[] {
  const copy = [...values]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1))
    const temporary = copy[index]
    copy[index] = copy[other] as T
    copy[other] = temporary as T
  }
  return copy
}

function createHamiltonianPath(rows: number, columns: number, random: Random): NumberPathPosition[] | undefined {
  const targetLength = rows * columns
  const starts = shuffled(
    Array.from({ length: targetLength }, (_, index) => ({ row: Math.floor(index / columns), column: index % columns })),
    random,
  )

  for (const start of starts) {
    const path: NumberPathPosition[] = []
    const used = new Set<string>()
    let nodesVisited = 0
    const walk = (position: NumberPathPosition): boolean => {
      if (nodesVisited >= 180_000) return false
      nodesVisited += 1
      path.push(position)
      used.add(positionKey(position))
      if (path.length === targetLength) return true

      const candidates = shuffled(neighbors(position, rows, columns).filter((candidate) => !used.has(positionKey(candidate))), random)
        .sort((left, right) => {
          const leftDegree = neighbors(left, rows, columns).filter((candidate) => !used.has(positionKey(candidate))).length
          const rightDegree = neighbors(right, rows, columns).filter((candidate) => !used.has(positionKey(candidate))).length
          return leftDegree - rightDegree
        })
      for (const candidate of candidates) {
        if (walk(candidate)) return true
      }
      used.delete(positionKey(position))
      path.pop()
      return false
    }

    if (walk(start)) return path
  }
  return undefined
}

function withVisibleValues(level: NumberPathLevel, visibleValues: ReadonlySet<number>): NumberPathLevel {
  return {
    ...level,
    cells: level.cells.map((cell) => cell.blocked ? cell : { ...cell, visible: visibleValues.has(cell.value) }),
  }
}

function solveWithEnoughClues(level: NumberPathLevel, path: readonly NumberPathPosition[], clueStride: number): NumberPathLevel {
  const visibleValues = new Set<number>([1, level.maxNumber])
  path.forEach((_, index) => {
    const value = index + 1
    if ((value - 1) % clueStride === 0) visibleValues.add(value)
  })
  const candidatesToReveal = path.map((_, index) => index + 1).filter((value) => !visibleValues.has(value))
  let revealIndex = 0

  while (revealIndex <= candidatesToReveal.length) {
    const candidate = withVisibleValues(level, visibleValues)
    const result = solveNumberPath(candidate, { maxSolutions: 2, maxNodes: 20_000 })
    if (!result.stoppedEarly && result.solutions.length === 1) return candidate
    const nextValue = candidatesToReveal[revealIndex]
    if (nextValue === undefined) break
    visibleValues.add(nextValue)
    revealIndex += 1
  }

  throw new Error('Unable to validate generated Number Path level')
}

export function generatePracticeLevel(difficulty: NumberPathDifficulty, seed: number): NumberPathLevel {
  const spec = PRACTICE_SPECS[difficulty]
  const random = createRandom(seed)
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const path = createHamiltonianPath(spec.rows, spec.columns, random)
    if (!path) continue
    const level = buildNumberPathLevel({
      id: `practice-${difficulty}-${seed >>> 0}-${attempt + 1}`,
      name: '新路徑',
      difficulty,
      rows: spec.rows,
      columns: spec.columns,
      clueStride: spec.clueStride,
      path,
    })
    return solveWithEnoughClues(level, path, spec.clueStride)
  }
  throw new Error('Unable to generate a Number Path practice level')
}
