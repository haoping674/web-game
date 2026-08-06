import { buildNumberPathLevel } from './levels'
import { solveNumberPath } from './solver'
import type { NumberPathDifficulty, NumberPathLevel, NumberPathPosition } from './types'

type PracticeSpec = {
  rows: number
  columns: number
  maximumClueCount: number
  maximumNodes: number
  maximumAttempts: number
}

const PRACTICE_SPECS = {
  easy: { rows: 4, columns: 4, maximumClueCount: 10, maximumNodes: 80_000, maximumAttempts: 36 },
  normal: { rows: 4, columns: 5, maximumClueCount: 12, maximumNodes: 100_000, maximumAttempts: 48 },
  hard: { rows: 5, columns: 5, maximumClueCount: 15, maximumNodes: 140_000, maximumAttempts: 60 },
} as const satisfies Record<NumberPathDifficulty, PracticeSpec>

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

function samePath(left: readonly NumberPathPosition[], right: readonly NumberPathPosition[]): boolean {
  return left.length === right.length && left.every((position, index) => {
    const other = right[index]
    return other !== undefined && positionKey(position) === positionKey(other)
  })
}

function neighbors(position: NumberPathPosition, rows: number, columns: number): NumberPathPosition[] {
  return [-1, 0, 1].flatMap((rowOffset) => [-1, 0, 1].map((columnOffset) => ({
    row: position.row + rowOffset,
    column: position.column + columnOffset,
  }))).filter((candidate) => (
    (candidate.row !== position.row || candidate.column !== position.column)
    && candidate.row >= 0
    && candidate.row < rows
    && candidate.column >= 0
    && candidate.column < columns
  ))
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

function createAlternatingClues(maxNumber: number): Set<number> {
  const visibleValues = new Set<number>()
  for (let value = 1; value <= maxNumber; value += 2) visibleValues.add(value)
  visibleValues.add(maxNumber)
  return visibleValues
}

function withVisibleValues(level: NumberPathLevel, visibleValues: ReadonlySet<number>): NumberPathLevel {
  return {
    ...level,
    cells: level.cells.map((cell) => cell.blocked ? cell : { ...cell, visible: visibleValues.has(cell.value) }),
  }
}

function distanceToClosestClue(value: number, visibleValues: ReadonlySet<number>): number {
  return Math.min(...[...visibleValues].map((visibleValue) => Math.abs(value - visibleValue)))
}

function chooseDiscriminatingClue(
  intendedPath: readonly NumberPathPosition[],
  alternativePath: readonly NumberPathPosition[],
  visibleValues: ReadonlySet<number>,
): number | undefined {
  return intendedPath
    .map((position, index) => ({ value: index + 1, differs: positionKey(position) !== positionKey(alternativePath[index] ?? position) }))
    .filter((candidate) => candidate.differs && !visibleValues.has(candidate.value))
    .sort((left, right) => distanceToClosestClue(right.value, visibleValues) - distanceToClosestClue(left.value, visibleValues) || left.value - right.value)[0]
    ?.value
}

function chooseLargestUncluedGap(visibleValues: ReadonlySet<number>): number | undefined {
  const values = [...visibleValues].sort((left, right) => left - right)
  let best: { from: number; to: number } | undefined
  for (let index = 1; index < values.length; index += 1) {
    const from = values[index - 1]
    const to = values[index]
    if (from === undefined || to === undefined || to - from < 3) continue
    if (!best || to - from > best.to - best.from) best = { from, to }
  }
  if (!best) return undefined
  const middle = Math.floor((best.from + best.to) / 2)
  return visibleValues.has(middle) ? undefined : middle
}

function createUniquelySolvableLevel(
  level: NumberPathLevel,
  path: readonly NumberPathPosition[],
  spec: PracticeSpec,
): NumberPathLevel | undefined {
  const visibleValues = createAlternatingClues(level.maxNumber)

  while (visibleValues.size <= spec.maximumClueCount) {
    const candidate = withVisibleValues(level, visibleValues)
    const result = solveNumberPath(candidate, { maxSolutions: 2, maxNodes: spec.maximumNodes })
    if (!result.stoppedEarly && result.solutions.length === 1) return candidate
    if (visibleValues.size === spec.maximumClueCount) return undefined

    const alternative = result.solutions.find((solution) => !samePath(path, solution))
    const nextClue = alternative
      ? chooseDiscriminatingClue(path, alternative, visibleValues)
      : chooseLargestUncluedGap(visibleValues)
    if (nextClue === undefined) return undefined
    visibleValues.add(nextClue)
  }
  return undefined
}

export function generatePracticeLevel(difficulty: NumberPathDifficulty, seed: number): NumberPathLevel {
  const spec = PRACTICE_SPECS[difficulty]
  const random = createRandom(seed)
  for (let attempt = 0; attempt < spec.maximumAttempts; attempt += 1) {
    const path = createHamiltonianPath(spec.rows, spec.columns, random)
    if (!path) continue
    const level = buildNumberPathLevel({
      id: `practice-${difficulty}-${seed >>> 0}-${attempt + 1}`,
      name: '新路徑',
      difficulty,
      rows: spec.rows,
      columns: spec.columns,
      clueStride: path.length,
      path,
    })
    const uniquelySolvableLevel = createUniquelySolvableLevel(level, path, spec)
    if (uniquelySolvableLevel) return uniquelySolvableLevel
  }
  throw new Error('Unable to generate a uniquely solvable Number Path practice level')
}
