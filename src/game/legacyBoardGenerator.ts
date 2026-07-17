import { BOARD_COLUMNS, BOARD_ROWS, BOARD_SIZE, TARGET_SUM } from './constants'
import type { RandomSource } from './random'
import type { CellValue } from './types'
import { findValidMove } from './validMoveFinder'
import { shuffle } from './random'

/** Exact pre-balance generator retained only for reproducible before/after reports. */
export function generateLegacyBoard(random: RandomSource = Math.random): CellValue[][] {
  const values = Array.from({ length: BOARD_SIZE - 4 }, () => Math.floor(random() * 9) + 1)
  const remainder = values.reduce((sum, value) => sum + value, 0) % TARGET_SUM
  const required = (TARGET_SUM - remainder) % TARGET_SUM
  const [first, second] = digitsForRemainder(required)
  values.push(first, second, 1, 9)
  return Array.from({ length: BOARD_ROWS }, (_, row) =>
    values.slice(row * BOARD_COLUMNS, (row + 1) * BOARD_COLUMNS),
  )
}

/** Exact pre-balance reshuffle behavior for baseline simulation only. */
export function legacyReshuffleRemaining(board: CellValue[][], random: RandomSource): CellValue[][] {
  const positions = board.flatMap((row, rowIndex) => row.flatMap((value, column) => value === null ? [] : [{ row: rowIndex, column }]))
  const values = shuffle(positions.map(({ row, column }) => board[row]?.[column] ?? 1), random)
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

function digitsForRemainder(remainder: number): [number, number] {
  for (let first = 1; first <= 9; first += 1) {
    for (let second = 1; second <= 9; second += 1) {
      if ((first + second) % TARGET_SUM === remainder) return [first, second]
    }
  }
  throw new Error('Unable to balance legacy board total')
}
