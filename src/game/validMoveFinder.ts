import { balanceConfig } from './balanceConfig'
import { findAllValidMoves } from './boardAnalyzer'
import { normalizeRect, getRectangleCells, sumSelection } from './selectionCalculator'
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
  if (positions.length < 2) return board.map((row) => [...row])

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const next = placeValuesAtExistingPositions(board, positions, randomValues(positions.length, random))
    if (findValidMove(next)) return next
  }

  // Keep the cleared/occupied layout intact even when the random draws cannot
  // immediately create another target-sum selection.
  return placeValuesAtExistingPositions(board, positions, randomValues(positions.length, random))
}

function placeValuesAtExistingPositions(board: CellValue[][], positions: readonly { row: number, column: number }[], values: readonly number[]): CellValue[][] {
  const next = board.map((row) => [...row])
  positions.forEach((position, index) => {
    const value = values[index]
    if (value !== undefined) next[position.row]![position.column] = value
  })
  return next
}

function randomValues(count: number, random: RandomSource): number[] {
  return Array.from({ length: count }, () => Math.floor(random() * 9) + 1)
}
