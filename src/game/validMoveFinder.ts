import { balanceConfig } from './balanceConfig'
import { findAllValidMoves } from './boardAnalyzer'
import { normalizeRect, getRectangleCells, sumSelection } from './selectionCalculator'
import { shuffle } from './random'
import type { RandomSource } from './random'
import type { CellValue, GridRect } from './types'

export function findValidMove(board: CellValue[][]): GridRect | null {
  return findAllValidMoves(board)[0]?.rect ?? null
}

export function selectHintMove(board: CellValue[][], random: RandomSource = Math.random): GridRect | null {
  const moves = findAllValidMoves(board)
  if (moves.length === 0) return null
  const preferred = moves.filter((move) =>
    move.area >= balanceConfig.hint.preferredMinimumArea
    && move.area <= balanceConfig.hint.preferredMaximumArea,
  )
  const pool = preferred.length > 0 ? preferred : moves
  return pool[Math.floor(random() * pool.length)]?.rect ?? pool[0]?.rect ?? null
}

export function isValidMove(board: CellValue[][], rect: GridRect): boolean {
  const normalized = normalizeRect(rect)
  const cells = getRectangleCells(normalized)
  return cells.length > 0
    && cells.every(({ row, column }) => board[row]?.[column] !== undefined)
    && cells.some(({ row, column }) => board[row]?.[column] !== null && board[row]?.[column] !== undefined)
    && sumSelection(board, normalized) === balanceConfig.targetSum
}

export function reshuffleRemaining(board: CellValue[][], random: RandomSource = Math.random): CellValue[][] {
  const positions = board.flatMap((row, rowIndex) => row.flatMap((value, column) => value === null ? [] : [{ row: rowIndex, column }]))
  const values = positions.map(({ row, column }) => board[row]?.[column]).filter((value): value is number => value !== null && value !== undefined)
  if (values.length < 2) return board.map((row) => [...row])

  // A system repair should restore a playable remainder, not merely one move.
  if (findValidMove(board) === null) return createSustainableRemainingBoard(board, values.length, random)

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const shuffled = shuffle(values, random)
    const next = board.map((row) => [...row])
    positions.forEach((position, index) => { next[position.row]![position.column] = shuffled[index]! })
    if (findValidMove(next)) return next
  }
  return createSustainableRemainingBoard(board, values.length, random)
}

function createSustainableRemainingBoard(board: CellValue[][], fruitCount: number, random: RandomSource): CellValue[][] {
  const rows = board.length
  const columns = board[0]?.length ?? 0
  const next = board.map((row) => row.map(() => null as CellValue))
  let row = 0
  let remaining = fruitCount
  while (remaining >= 2 && row < rows) {
    let cellsInRow = Math.min(columns, remaining)
    if (remaining - cellsInRow === 1) cellsInRow -= 1
    let column = 0
    if (cellsInRow % 2 === 1) {
      createComposition(10, 3, random).forEach((value, offset) => { next[row]![offset] = value })
      column = 3
    }
    while (column < cellsInRow) {
      createComposition(10, 2, random).forEach((value, offset) => { next[row]![column + offset] = value })
      column += 2
    }
    remaining -= cellsInRow
    row += 1
  }
  if (remaining === 1) next[rows - 1]![columns - 1] = randomIntegerValue(random)
  return next
}

function createComposition(total: number, count: number, random: RandomSource): number[] {
  if (count === 0) return []
  const values = Array.from({ length: count }, () => 1)
  let remaining = Math.max(0, total - count)
  const order = shuffle(Array.from({ length: count }, (_, index) => index), random)
  while (remaining > 0) {
    let changed = false
    for (const index of order) {
      const available = 9 - (values[index] ?? 1)
      if (available <= 0) continue
      const addition = Math.min(available, remaining)
      values[index]! += addition
      remaining -= addition
      changed = true
      if (remaining === 0) break
    }
    if (!changed) break
  }
  return shuffle(values, random)
}

function randomIntegerValue(random: RandomSource): number {
  return Math.floor(random() * 9) + 1
}
