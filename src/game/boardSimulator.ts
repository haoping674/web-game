import { analyzeBoard } from './boardAnalyzer'
import type { BoardProgressSnapshot, ValidMove } from './balanceTypes'
import type { CellValue } from './types'

export const PROGRESS_CHECKPOINTS = [0.1, 0.25, 0.5, 0.75] as const

export function clearValidMove(board: CellValue[][], move: ValidMove): CellValue[][] {
  const next = board.map((row) => [...row])
  move.cells.forEach(({ row, column }) => {
    if (next[row]?.[column] !== undefined) next[row]![column] = null
  })
  return next
}

export function simulateBoardProgress(
  board: CellValue[][],
  checkpoints: readonly number[] = PROGRESS_CHECKPOINTS,
): BoardProgressSnapshot[] {
  const initialFruitCount = board.flat().filter((value) => value !== null).length
  let current = board.map((row) => [...row])
  let analysis = analyzeBoard(current)
  const snapshots: BoardProgressSnapshot[] = []

  for (const checkpoint of checkpoints) {
    const targetRemaining = Math.ceil(initialFruitCount * (1 - checkpoint))
    while (analysis.fruitCount > targetRemaining && analysis.validMoves.length > 0) {
      const selected = selectSustainableMove(analysis.validMoves, analysis.cellParticipation)
      current = clearValidMove(current, selected)
      analysis = analyzeBoard(current)
    }
    const actualClearedRatio = initialFruitCount === 0 ? 0 : (initialFruitCount - analysis.fruitCount) / initialFruitCount
    snapshots.push({
      clearedRatio: actualClearedRatio,
      remainingFruit: analysis.fruitCount,
      validMoveCount: analysis.validMoveCount,
      coverageRatio: analysis.coverageRatio,
      occupiedRegionCount: analysis.occupiedRegionCount,
      scorePotential: analysis.scorePotential,
      hasMove: analysis.validMoveCount > 0,
    })
  }
  return snapshots
}

function selectSustainableMove(moves: readonly ValidMove[], participation: readonly number[][]): ValidMove {
  return [...moves].sort((first, second) => {
    const firstCost = first.cells.reduce((sum, cell) => sum + (participation[cell.row]?.[cell.column] ?? 0), 0) / first.fruitCount
    const secondCost = second.cells.reduce((sum, cell) => sum + (participation[cell.row]?.[cell.column] ?? 0), 0) / second.fruitCount
    return firstCost - secondCost
      || second.fruitCount - first.fruitCount
      || first.area - second.area
      || first.rect.start.row - second.rect.start.row
      || first.rect.start.column - second.rect.start.column
  })[0]!
}
