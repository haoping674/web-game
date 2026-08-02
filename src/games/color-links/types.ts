export const COLOR_IDS = ['coral', 'amber', 'teal', 'blue', 'plum'] as const
export const DIRECTIONS = ['up', 'right', 'down', 'left'] as const

export type ColorId = (typeof COLOR_IDS)[number]
export type Direction = (typeof DIRECTIONS)[number]
export type ColorLinksCell = ColorId | null
export type ColorLinksBoard = ColorLinksCell[][]
export type CellPosition = { row: number; column: number }

export type LocatedTile = CellPosition & {
  color: ColorId
  direction: Direction
}

export type NearestTiles = Partial<Record<Direction, LocatedTile>>

export type MatchGroup = {
  color: ColorId
  tiles: LocatedTile[]
}

export type BoardQuality = {
  validMoveCount: number
  filledRatio: number
  maxColorRatio: number
  score: number
  acceptable: boolean
}

export type ColorLinksStatus = 'ready' | 'playing' | 'paused' | 'finished'

export type ColorLinksState = {
  board: ColorLinksBoard
  status: ColorLinksStatus
  score: number
  elapsedSeconds: number
  nextTickAt: number | null
  successfulMoves: number
  invalidMoves: number
  removedTiles: number
  reshuffles: number
}
