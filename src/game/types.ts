export type CellValue = number | null

export type GridPoint = { row: number; column: number }

export type GridRect = { start: GridPoint; end: GridPoint }

export type GameStatus = 'start' | 'playing' | 'paused' | 'finished'

export type GameState = {
  board: CellValue[][]
  score: number
  secondsLeft: number
  status: GameStatus
}
