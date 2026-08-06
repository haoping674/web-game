export const NUMBER_PATH_DIFFICULTIES = ['easy', 'normal', 'hard'] as const

export type NumberPathDifficulty = (typeof NUMBER_PATH_DIFFICULTIES)[number]

export type NumberPathPosition = {
  row: number
  column: number
}

export type NumberPathCell = NumberPathPosition & {
  value: number
  visible: boolean
  blocked: boolean
}

export type NumberPathLevel = {
  id: string
  name: string
  difficulty: NumberPathDifficulty
  rows: number
  columns: number
  maxNumber: number
  cells: readonly NumberPathCell[]
}

export type NumberPathStatus = 'selecting' | 'playing' | 'paused' | 'finished'

export type NumberPathState = {
  status: NumberPathStatus
  levelId: string | null
  path: readonly NumberPathPosition[]
  elapsedSeconds: number
  nextTickAt: number | null
  errors: number
  hintsUsed: number
}

export type NumberPathCompletion = {
  bestTimeSeconds: number
  leastErrors: number
  hintsUsed: number
  completedAt: string
}

export type NumberPathProgress = {
  unlockedLevelIds: readonly string[]
  completedByLevel: Readonly<Record<string, NumberPathCompletion>>
  selectedDifficulty: NumberPathDifficulty
  showSolvedNumbers: boolean
}
