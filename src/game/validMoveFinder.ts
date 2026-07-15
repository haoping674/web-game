import { BOARD_COLUMNS, BOARD_ROWS, TARGET_SUM } from './constants'
import { normalizeRect, sumSelection } from './selectionCalculator'
import type { CellValue, GridRect } from './types'

export function findValidMove(board: CellValue[][]): GridRect | null {
  const rows = Math.min(BOARD_ROWS, board.length)
  const columns = Math.min(BOARD_COLUMNS, board[0]?.length ?? 0)
  for (let top = 0; top < rows; top += 1) {
    for (let left = 0; left < columns; left += 1) {
      for (let bottom = top; bottom < rows; bottom += 1) {
        let sum = 0
        let hasFruit = false
        let hasClearedCell = false
        for (let right = left; right < columns; right += 1) {
          for (let row = top; row <= bottom; row += 1) {
            const value = board[row]?.[right] ?? null
            if (value === null) hasClearedCell = true
            sum += value ?? 0
            hasFruit ||= value !== null
          }
          if (sum === TARGET_SUM && hasFruit && !hasClearedCell) return { start: { row: top, column: left }, end: { row: bottom, column: right } }
          if (sum > TARGET_SUM) break
        }
      }
    }
  }
  return null
}

export function isValidMove(board: CellValue[][], rect: GridRect): boolean {
  const normalized = normalizeRect(rect)
  return sumSelection(board, normalized) === TARGET_SUM
}

export function reshuffleRemaining(board: CellValue[][], random: () => number = Math.random): CellValue[][] {
  const positions = board.flatMap((row, rowIndex) => row.flatMap((value, column) => value === null ? [] : [{ row: rowIndex, column }]))
  const values = positions.map(({ row, column }) => board[row]?.[column] ?? 1)
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    ;[values[index], values[swap]] = [values[swap]!, values[index]!]
  }
  const next = board.map((row) => [...row])
  positions.forEach((position, index) => { next[position.row]![position.column] = values[index]! })
  if (findValidMove(next) || positions.length < 2) return next
  const adjacent = positions.find((point, index) => {
    const following = positions[index + 1]
    return following !== undefined && point.row === following.row && point.column + 1 === following.column
  })
  if (adjacent) {
    next[adjacent.row]![adjacent.column] = 1
    next[adjacent.row]![adjacent.column + 1] = 9
  }
  return next
}
