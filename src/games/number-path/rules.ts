import type { NumberPathCell, NumberPathLevel, NumberPathPosition } from './types'

export function positionKey(position: NumberPathPosition): string {
  return `${position.row}:${position.column}`
}

export function samePosition(left: NumberPathPosition, right: NumberPathPosition): boolean {
  return left.row === right.row && left.column === right.column
}

export function findNumberPathCell(level: NumberPathLevel, position: NumberPathPosition): NumberPathCell | undefined {
  return level.cells.find((cell) => samePosition(cell, position))
}

export function findPositionForValue(level: NumberPathLevel, value: number): NumberPathPosition | undefined {
  const cell = level.cells.find((candidate) => candidate.value === value)
  return cell ? { row: cell.row, column: cell.column } : undefined
}

export function areOrthogonallyAdjacent(left: NumberPathPosition, right: NumberPathPosition): boolean {
  return Math.abs(left.row - right.row) + Math.abs(left.column - right.column) === 1
}

export function getNeighborPositions(level: NumberPathLevel, position: NumberPathPosition): NumberPathPosition[] {
  const candidates = [
    { row: position.row - 1, column: position.column },
    { row: position.row, column: position.column + 1 },
    { row: position.row + 1, column: position.column },
    { row: position.row, column: position.column - 1 },
  ]
  return candidates.filter((candidate) => {
    const cell = findNumberPathCell(level, candidate)
    return cell !== undefined && !cell.blocked
  })
}

export function isPathPositionUsed(path: readonly NumberPathPosition[], position: NumberPathPosition): boolean {
  return path.some((entry) => samePosition(entry, position))
}

export function isCorrectNextPosition(
  level: NumberPathLevel,
  path: readonly NumberPathPosition[],
  position: NumberPathPosition,
): boolean {
  const cell = findNumberPathCell(level, position)
  if (!cell || cell.blocked || isPathPositionUsed(path, position)) return false
  if (path.length === 0) return cell.value === 1
  const last = path.at(-1)
  if (!last || !areOrthogonallyAdjacent(last, position)) return false
  return cell.value === path.length + 1
}

export function distanceBetween(left: NumberPathPosition, right: NumberPathPosition): number {
  return Math.abs(left.row - right.row) + Math.abs(left.column - right.column)
}
