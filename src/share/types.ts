export type ShareMode = 'classic' | 'daily'

export type ShareResult = {
  mode: ShareMode
  score: number
  maxCombo: number
  clearedFruitCount: number
  successfulMoves: number
  playedAt: Date
  dailyChallengeId?: string
  pageUrl: string
}

export type ShareActionResult = 'shared' | 'cancelled' | 'unavailable' | 'failed'
