import { COLOR_LINKS_CONFIG } from './config'
import {
  COLOR_IDS,
  DIRECTIONS,
  type BoardQuality,
  type CellPosition,
  type ColorId,
  type ColorLinksBoard,
  type Direction,
  type LocatedTile,
  type MatchGroup,
  type NearestTiles,
} from './types'

const DIRECTION_DELTAS = {
  up: [-1, 0],
  right: [0, 1],
  down: [1, 0],
  left: [0, -1],
} as const satisfies Record<Direction, readonly [number, number]>

function inBounds(board: ColorLinksBoard, row: number, column: number): boolean {
  return row >= 0 && row < board.length && column >= 0 && column < (board[row]?.length ?? 0)
}

export function findNearestTiles(board: ColorLinksBoard, position: CellPosition): NearestTiles {
  if (!inBounds(board, position.row, position.column)) return {}
  if (board[position.row]?.[position.column] !== null) return {}
  const nearest: NearestTiles = {}
  for (const direction of DIRECTIONS) {
    const [rowDelta, columnDelta] = DIRECTION_DELTAS[direction]
    let row = position.row + rowDelta
    let column = position.column + columnDelta
    while (inBounds(board, row, column)) {
      const color = board[row]?.[column]
      if (color !== null && color !== undefined) {
        nearest[direction] = { row, column, color, direction }
        break
      }
      row += rowDelta
      column += columnDelta
    }
  }
  return nearest
}

export function findMatchesAtCell(board: ColorLinksBoard, position: CellPosition): MatchGroup[] {
  const nearest = findNearestTiles(board, position)
  const byColor = new Map<ColorId, LocatedTile[]>()
  for (const direction of DIRECTIONS) {
    const tile = nearest[direction]
    if (!tile) continue
    const group = byColor.get(tile.color)
    if (group) group.push(tile)
    else byColor.set(tile.color, [tile])
  }
  const matches: MatchGroup[] = []
  for (const color of COLOR_IDS) {
    const tiles = byColor.get(color)
    if (tiles && tiles.length >= 2) matches.push({ color, tiles })
  }
  return matches
}

export function findAllValidMoves(board: ColorLinksBoard): CellPosition[] {
  const moves: CellPosition[] = []
  for (let row = 0; row < board.length; row += 1) {
    const boardRow = board[row] ?? []
    for (let column = 0; column < boardRow.length; column += 1) {
      if (boardRow[column] === null && findMatchesAtCell(board, { row, column }).length > 0) {
        moves.push({ row, column })
      }
    }
  }
  return moves
}

export function evaluateBoardQuality(board: ColorLinksBoard): BoardQuality {
  const totalCells = board.reduce((total, row) => total + row.length, 0)
  const colorCounts = new Map<ColorId, number>()
  let filled = 0
  for (const row of board) {
    for (const cell of row) {
      if (cell === null) continue
      filled += 1
      colorCounts.set(cell, (colorCounts.get(cell) ?? 0) + 1)
    }
  }
  const validMoveCount = findAllValidMoves(board).length
  const filledRatio = totalCells === 0 ? 0 : filled / totalCells
  const largestColor = Math.max(0, ...colorCounts.values())
  const maxColorRatio = filled === 0 ? 0 : largestColor / filled
  const fillPenalty = Math.abs(filledRatio - COLOR_LINKS_CONFIG.targetFilledRatio) * 40
  const dominancePenalty = Math.max(0, maxColorRatio - 0.32) * 80
  const score = validMoveCount * 4 - fillPenalty - dominancePenalty
  return {
    validMoveCount,
    filledRatio,
    maxColorRatio,
    score,
    acceptable:
      validMoveCount >= COLOR_LINKS_CONFIG.minimumOpeningMoves
      && filledRatio >= 0.46
      && filledRatio <= 0.7
      && maxColorRatio <= 0.36,
  }
}

function createCandidate(random: () => number): ColorLinksBoard {
  const { rows, columns, initialTileCount } = COLOR_LINKS_CONFIG
  const cells = shuffle([
    ...Array.from({ length: initialTileCount }, (_, index) => COLOR_IDS[index % COLOR_IDS.length]!),
    ...Array<null>(rows * columns - initialTileCount).fill(null),
  ], random)
  return Array.from({ length: rows }, (_, row) =>
    cells.slice(row * columns, (row + 1) * columns),
  )
}

function createFallbackBoard(): ColorLinksBoard {
  const board: ColorLinksBoard = Array.from({ length: COLOR_LINKS_CONFIG.rows }, (_, row) =>
    Array.from({ length: COLOR_LINKS_CONFIG.columns }, (_, column) =>
      column < 15 && column % 3 !== 1
        ? COLOR_IDS[(row + Math.floor(column / 3)) % COLOR_IDS.length]!
        : null,
    ),
  )
  return board
}

export function generateBoard(random: () => number = Math.random): ColorLinksBoard {
  let bestBoard: ColorLinksBoard | null = null
  let bestScore = Number.NEGATIVE_INFINITY
  for (let attempt = 0; attempt < COLOR_LINKS_CONFIG.generationAttempts; attempt += 1) {
    const candidate = createCandidate(random)
    const quality = evaluateBoardQuality(candidate)
    if (quality.acceptable) return candidate
    if (quality.score > bestScore) {
      bestBoard = candidate
      bestScore = quality.score
    }
  }
  const fallback = createFallbackBoard()
  return evaluateBoardQuality(fallback).validMoveCount > 0 ? fallback : (bestBoard ?? fallback)
}

function shuffle<T>(values: readonly T[], random: () => number): T[] {
  const result = [...values]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1))
    const currentValue = result[index]
    const otherValue = result[other]
    if (currentValue === undefined || otherValue === undefined) continue
    result[index] = otherValue
    result[other] = currentValue
  }
  return result
}

export function reshuffleRemainingTiles(
  board: ColorLinksBoard,
  random: () => number = Math.random,
): { board: ColorLinksBoard; stranded: boolean } {
  const positions: CellPosition[] = []
  const colors: ColorId[] = []
  board.forEach((row, rowIndex) => {
    row.forEach((cell, column) => {
      if (cell === null) return
      positions.push({ row: rowIndex, column })
      colors.push(cell)
    })
  })
  // Only singleton colors are truly unmatchable; a blocked pair can be relocated.
  const pairedColor = colors.find((color, index) => colors.indexOf(color) !== index)
  if (pairedColor === undefined) return { board, stranded: true }
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const next: ColorLinksBoard = board.map((row) => row.map(() => null))
    const shuffled = shuffle(colors, random)
    positions.forEach((position, index) => {
      const color = shuffled[index]
      if (color !== undefined && next[position.row]) next[position.row]![position.column] = color
    })
    if (findAllValidMoves(next).length > 0) return { board: next, stranded: false }
  }
  // Reserve an empty origin and two adjacent neighbors, then redistribute all
  // remaining tiles. This guarantees a legal move without adding/removing tiles.
  for (let row = 0; row < board.length; row += 1) {
    for (let column = 0; column < (board[row]?.length ?? 0); column += 1) {
      const neighbors = DIRECTIONS.map((direction) => {
        const [dr, dc] = DIRECTION_DELTAS[direction]
        return { row: row + dr, column: column + dc }
      }).filter((position) => inBounds(board, position.row, position.column))
      const [first, second] = neighbors
      if (!first || !second) continue
      const next: ColorLinksBoard = board.map((cells) => cells.map(() => null))
      next[first.row]![first.column] = pairedColor
      next[second.row]![second.column] = pairedColor
      const remaining = [...colors]
      remaining.splice(remaining.indexOf(pairedColor), 1)
      remaining.splice(remaining.indexOf(pairedColor), 1)
      const slots: CellPosition[] = []
      next.forEach((cells, r) => cells.forEach((cell, c) => {
        if (cell === null && !(r === row && c === column)) slots.push({ row: r, column: c })
      }))
      if (remaining.length > slots.length) continue
      shuffle(slots, random).forEach((position, index) => {
        const color = remaining[index]
        if (color !== undefined) next[position.row]![position.column] = color
      })
      return { board: next, stranded: false }
    }
  }
  throw new Error('Color Links recovery requires an empty origin with two neighbors')
}

export function removeMatchedTiles(board: ColorLinksBoard, matches: readonly MatchGroup[]): ColorLinksBoard {
  const next = board.map((row) => [...row])
  for (const match of matches) {
    for (const tile of match.tiles) {
      if (next[tile.row]) next[tile.row]![tile.column] = null
    }
  }
  return next
}
