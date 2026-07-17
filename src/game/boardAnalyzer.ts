import { TARGET_SUM } from './constants'
import { getRectangleCells } from './selectionCalculator'
import type { BoardAnalysis, ValidMove } from './balanceTypes'
import type { CellValue, GridRect } from './types'

const REGION_ROWS = 3
const REGION_COLUMNS = 3

export function findAllValidMoves(board: CellValue[][], target = TARGET_SUM): ValidMove[] {
  const rows = board.length
  const columns = board[0]?.length ?? 0
  if (rows === 0 || columns === 0) return []
  const sumPrefix = buildPrefix(board, (value) => value ?? 0)
  const occupiedPrefix = buildPrefix(board, (value) => value === null ? 0 : 1)
  const moves: ValidMove[] = []
  const seenFruitSets = new Set<string>()

  for (let top = 0; top < rows; top += 1) {
    for (let left = 0; left < columns; left += 1) {
      for (let bottom = top; bottom < rows; bottom += 1) {
        for (let right = left; right < columns; right += 1) {
          const occupied = rectangleValue(occupiedPrefix, top, left, bottom, right)
          if (occupied === 0) continue
          const sum = rectangleValue(sumPrefix, top, left, bottom, right)
          if (sum !== target) continue
          const candidate = { start: { row: top, column: left }, end: { row: bottom, column: right } }
          const cells = getRectangleCells(candidate).filter(({ row, column }) => board[row]?.[column] !== null)
          const key = cells.map(({ row, column }) => `${row}:${column}`).join('|')
          if (seenFruitSets.has(key)) continue
          seenFruitSets.add(key)
          const rect = boundingRect(cells)
          moves.push({ rect, cells, fruitCount: occupied, area: rectangleArea(rect), region: regionForRect(rect, rows, columns) })
        }
      }
    }
  }
  return moves
}

function boundingRect(cells: readonly { row: number; column: number }[]): GridRect {
  const rows = cells.map(({ row }) => row)
  const columns = cells.map(({ column }) => column)
  return {
    start: { row: Math.min(...rows), column: Math.min(...columns) },
    end: { row: Math.max(...rows), column: Math.max(...columns) },
  }
}

function rectangleArea(rect: GridRect): number {
  return (rect.end.row - rect.start.row + 1) * (rect.end.column - rect.start.column + 1)
}

export function analyzeBoard(board: CellValue[][], target = TARGET_SUM): BoardAnalysis {
  const rows = board.length
  const columns = board[0]?.length ?? 0
  const validMoves = findAllValidMoves(board, target)
  const fruitCount = board.flat().filter((value) => value !== null).length
  const cellParticipation = board.map((row) => row.map(() => 0))
  const covered = new Set<string>()
  const regionMoveCounts = Array.from({ length: REGION_ROWS * REGION_COLUMNS }, () => 0)
  const digitFrequency = emptyDigitRecord()
  const digitMoveParticipation = emptyDigitRecord()

  board.forEach((row) => row.forEach((value) => {
    if (value !== null) digitFrequency[value] = (digitFrequency[value] ?? 0) + 1
  }))
  validMoves.forEach((move) => {
    regionMoveCounts[move.region] = (regionMoveCounts[move.region] ?? 0) + 1
    move.cells.forEach(({ row, column }) => {
      covered.add(`${row}:${column}`)
      const participationRow = cellParticipation[row]
      if (participationRow?.[column] !== undefined) participationRow[column] += 1
      const value = board[row]?.[column]
      if (value !== null && value !== undefined) digitMoveParticipation[value] = (digitMoveParticipation[value] ?? 0) + 1
    })
  })

  const moveSizeDistribution = {
    one: validMoves.filter((move) => move.fruitCount === 1).length,
    two: validMoves.filter((move) => move.fruitCount === 2).length,
    three: validMoves.filter((move) => move.fruitCount === 3).length,
    fourPlus: validMoves.filter((move) => move.fruitCount >= 4).length,
  }
  const totalParticipations = validMoves.reduce((sum, move) => sum + move.fruitCount, 0)
  const maxParticipation = Math.max(0, ...cellParticipation.flat())
  const maxCellParticipationRatio = validMoves.length === 0 ? 0 : maxParticipation / validMoves.length
  const unavoidableParticipation = validMoves.length === 0 ? 0 : 1 / validMoves.length
  const overlapScore = totalParticipations === 0 ? 0 : clampScore(100 - Math.max(0, maxCellParticipationRatio - unavoidableParticipation) * 400)
  const easiestMove = [...validMoves].sort(compareEasyMoves)[0] ?? null
  const largestMove = [...validMoves].sort((first, second) => second.fruitCount - first.fruitCount || second.area - first.area)[0] ?? null
  const occupiedRegionCount = regionMoveCounts.filter((count) => count > 0).length

  return {
    rows,
    columns,
    fruitCount,
    validMoves,
    validMoveCount: validMoves.length,
    uniqueValidMoveCount: new Set(validMoves.map(({ rect }) => rectKey(rect))).size,
    coveredFruitCount: covered.size,
    coverageRatio: fruitCount === 0 ? 0 : covered.size / fruitCount,
    moveSizeDistribution,
    simpleMoveRatio: validMoves.length === 0 ? 0 : (moveSizeDistribution.one + moveSizeDistribution.two) / validMoves.length,
    regionMoveCounts,
    occupiedRegionCount,
    spatialDistributionScore: normalizedEntropy(regionMoveCounts),
    cellParticipation,
    maxCellParticipationRatio,
    overlapScore,
    easiestMove,
    largestMove,
    averageArea: mean(validMoves.map((move) => move.area)),
    averageFruitCount: mean(validMoves.map((move) => move.fruitCount)),
    digitFrequency,
    digitMoveParticipation,
    scorePotential: covered.size,
  }
}

function buildPrefix(board: CellValue[][], project: (value: CellValue) => number): number[][] {
  const rows = board.length
  const columns = board[0]?.length ?? 0
  const prefix = Array.from({ length: rows + 1 }, () => Array.from({ length: columns + 1 }, () => 0))
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      prefix[row + 1]![column + 1] = project(board[row]?.[column] ?? null)
        + (prefix[row]?.[column + 1] ?? 0)
        + (prefix[row + 1]?.[column] ?? 0)
        - (prefix[row]?.[column] ?? 0)
    }
  }
  return prefix
}

function rectangleValue(prefix: number[][], top: number, left: number, bottom: number, right: number): number {
  return (prefix[bottom + 1]?.[right + 1] ?? 0)
    - (prefix[top]?.[right + 1] ?? 0)
    - (prefix[bottom + 1]?.[left] ?? 0)
    + (prefix[top]?.[left] ?? 0)
}

function regionForRect(rect: GridRect, rows: number, columns: number): number {
  const centerRow = (rect.start.row + rect.end.row) / 2
  const centerColumn = (rect.start.column + rect.end.column) / 2
  const regionRow = Math.min(REGION_ROWS - 1, Math.floor(centerRow / Math.max(1, rows) * REGION_ROWS))
  const regionColumn = Math.min(REGION_COLUMNS - 1, Math.floor(centerColumn / Math.max(1, columns) * REGION_COLUMNS))
  return regionRow * REGION_COLUMNS + regionColumn
}

function normalizedEntropy(counts: readonly number[]): number {
  const total = counts.reduce((sum, count) => sum + count, 0)
  if (total === 0) return 0
  const entropy = counts.reduce((sum, count) => {
    if (count === 0) return sum
    const probability = count / total
    return sum - probability * Math.log(probability)
  }, 0)
  return clampScore(entropy / Math.log(counts.length) * 100)
}

function compareEasyMoves(first: ValidMove, second: ValidMove): number {
  return first.area - second.area
    || first.fruitCount - second.fruitCount
    || first.rect.start.row - second.rect.start.row
    || first.rect.start.column - second.rect.start.column
}

function rectKey(rect: GridRect): string {
  return `${rect.start.row}:${rect.start.column}:${rect.end.row}:${rect.end.column}`
}

function emptyDigitRecord(): Record<number, number> {
  return Object.fromEntries(Array.from({ length: 9 }, (_, index) => [index + 1, 0]))
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value))
}
