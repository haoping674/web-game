import { BOARD_COLUMNS, BOARD_ROWS, BOARD_SIZE, TARGET_SUM } from './constants'
import type { CellValue } from './types'

export type RandomSource = () => number

export function generateBoard(random: RandomSource = Math.random): CellValue[][] {
  const values = Array.from({ length: BOARD_SIZE - 4 }, () => randomDigit(random))
  const remainder = values.reduce((sum, value) => sum + value, 0) % TARGET_SUM
  const required = (TARGET_SUM - remainder) % TARGET_SUM
  const [first, second] = digitsForRemainder(required)

  // The final adjacent 1 + 9 creates an immediately discoverable valid rectangle.
  values.push(first, second, 1, 9)
  return Array.from({ length: BOARD_ROWS }, (_, row) =>
    values.slice(row * BOARD_COLUMNS, (row + 1) * BOARD_COLUMNS),
  )
}

function randomDigit(random: RandomSource): number {
  return Math.floor(random() * 9) + 1
}

function digitsForRemainder(remainder: number): [number, number] {
  for (let first = 1; first <= 9; first += 1) {
    for (let second = 1; second <= 9; second += 1) {
      if ((first + second) % TARGET_SUM === remainder) return [first, second]
    }
  }
  throw new Error('Unable to balance board total')
}
