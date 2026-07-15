import type { CellValue, GridPoint, GridRect } from './types'

export function normalizeRect(rect: GridRect): GridRect {
  return {
    start: { row: Math.min(rect.start.row, rect.end.row), column: Math.min(rect.start.column, rect.end.column) },
    end: { row: Math.max(rect.start.row, rect.end.row), column: Math.max(rect.start.column, rect.end.column) },
  }
}

export function getRectangleCells(rect: GridRect): GridPoint[] {
  const normalized = normalizeRect(rect)
  const cells: GridPoint[] = []
  for (let row = normalized.start.row; row <= normalized.end.row; row += 1) {
    for (let column = normalized.start.column; column <= normalized.end.column; column += 1) cells.push({ row, column })
  }
  return cells
}

export function sumSelection(board: CellValue[][], rect: GridRect): number {
  return getRectangleCells(rect).reduce((sum, { row, column }) => sum + (board[row]?.[column] ?? 0), 0)
}

export function isPointInRect(point: GridPoint, rect: GridRect): boolean {
  const normalized = normalizeRect(rect)
  return point.row >= normalized.start.row && point.row <= normalized.end.row
    && point.column >= normalized.start.column && point.column <= normalized.end.column
}
