import { distanceBetween, findNumberPathCell, getNeighborPositions, positionKey } from './rules'
import type { NumberPathLevel, NumberPathPosition } from './types'

type SolverOptions = { maxSolutions?: number; maxNodes?: number }

export type NumberPathSolveResult = {
  solutions: readonly (readonly NumberPathPosition[])[]
  nodesVisited: number
  stoppedEarly: boolean
}

function nextVisibleTarget(level: NumberPathLevel, afterValue: number): { value: number; position: NumberPathPosition } | undefined {
  const target = level.cells
    .filter((cell) => cell.visible && cell.value > afterValue)
    .sort((left, right) => left.value - right.value)[0]
  return target ? { value: target.value, position: { row: target.row, column: target.column } } : undefined
}

function unvisitedCellsStayConnected(level: NumberPathLevel, current: NumberPathPosition, used: ReadonlySet<string>): boolean {
  const available = level.cells.filter((cell) => !cell.blocked && !used.has(positionKey(cell)))
  if (available.length === 0) return true
  const start = available[0]
  if (!start) return true
  const visited = new Set<string>([positionKey(start)])
  const queue = [start]
  while (queue.length > 0) {
    const node = queue.shift()
    if (!node) break
    getNeighborPositions(level, node).forEach((neighbor) => {
      const key = positionKey(neighbor)
      if (key === positionKey(current) || used.has(key) || visited.has(key)) return
      visited.add(key)
      const cell = findNumberPathCell(level, neighbor)
      if (cell) queue.push(cell)
    })
  }
  return visited.size === available.length
}

function canStillReachNextClue(
  level: NumberPathLevel,
  current: NumberPathPosition,
  currentValue: number,
): boolean {
  const nextClue = nextVisibleTarget(level, currentValue)
  if (!nextClue) return true
  const steps = nextClue.value - currentValue
  const distance = distanceBetween(current, nextClue.position)
  return distance <= steps
}

export function solveNumberPath(level: NumberPathLevel, options: SolverOptions = {}): NumberPathSolveResult {
  const maxSolutions = options.maxSolutions ?? 2
  const maxNodes = options.maxNodes ?? 80_000
  const start = level.cells.find((cell) => cell.value === 1)
  if (!start || start.blocked) return { solutions: [], nodesVisited: 0, stoppedEarly: false }

  const solutions: NumberPathPosition[][] = []
  let nodesVisited = 0
  let stoppedEarly = false
  const startPosition = { row: start.row, column: start.column }

  const search = (current: NumberPathPosition, value: number, path: NumberPathPosition[], used: Set<string>): void => {
    if (solutions.length >= maxSolutions || nodesVisited >= maxNodes) {
      stoppedEarly = nodesVisited >= maxNodes
      return
    }
    nodesVisited += 1
    if (value === level.maxNumber) {
      solutions.push([...path])
      return
    }
    const nextValue = value + 1
    const forcedVisible = level.cells.find((cell) => cell.visible && cell.value === nextValue)
    const candidates = forcedVisible
      ? [{ row: forcedVisible.row, column: forcedVisible.column }]
      : getNeighborPositions(level, current)
    candidates.forEach((candidate) => {
      if (solutions.length >= maxSolutions || used.has(positionKey(candidate))) return
      if (!getNeighborPositions(level, current).some((neighbor) => positionKey(neighbor) === positionKey(candidate))) return
      const candidateCell = findNumberPathCell(level, candidate)
      if (!candidateCell || candidateCell.blocked) return
      const nextUsed = new Set(used).add(positionKey(candidate))
      if (!canStillReachNextClue(level, candidate, nextValue)) return
      if (!unvisitedCellsStayConnected(level, candidate, nextUsed)) return
      search(candidate, nextValue, [...path, candidate], nextUsed)
    })
  }

  search(startPosition, 1, [startPosition], new Set([positionKey(startPosition)]))
  return { solutions, nodesVisited, stoppedEarly }
}

export function hasUniqueNumberPathSolution(level: NumberPathLevel): boolean {
  const result = solveNumberPath(level, { maxSolutions: 2 })
  return !result.stoppedEarly && result.solutions.length === 1
}
