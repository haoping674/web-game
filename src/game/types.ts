import type { PlayableMode } from './modes'

export type CellValue = number | null

export type GridPoint = { row: number; column: number }
export type GridRect = { start: GridPoint; end: GridPoint }
export type GameStatus = 'start' | 'playing' | 'paused' | 'finished'
export type AnimationIntensity = 'full' | 'reduced' | 'off'

export type GameState = {
  mode: PlayableMode
  board: CellValue[][]
  score: number
  clearedFruitCount: number
  secondsLeft: number
  nextTickAt: number | null
  status: GameStatus
  combo: number
  bestCombo: number
  comboDeadline: number | null
  successfulMoves: number
  invalidMoves: number
  hintsUsed: number
  systemReshuffles: number
}

export type GameSettings = {
  soundEnabled: boolean
  volume: number
  animationsEnabled: boolean
  animationIntensity: AnimationIntensity
  lowStimulus: boolean
  hapticsEnabled: boolean
  showSelectionHelp: boolean
}

export type GameStatistics = {
  highScore: number
  lastScore: number
  gamesPlayed: number
  totalCleared: number
  highestCombo: number
  totalScore: number
  bestClearsPerMinute: number
}

export type StoredGameData = {
  version: number
  settings: GameSettings
  statisticsByMode: Record<PlayableMode, GameStatistics>
  tutorialSeen: boolean
  mobileGestureHintSeen: boolean
}
