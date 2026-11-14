import type { PlayableMode } from '../game/modes'

export type ShareMode = PlayableMode | 'daily'

export type LegacyShareResult = {
  mode: ShareMode
  score: number
  maxCombo: number
  clearedFruitCount: number
  successfulMoves: number
  playedAt: Date
  dailyChallengeId?: string
  pageUrl: string
}

export type ArcadeGameId = 'fruitSum' | 'secondSense' | 'lengthSense' | 'colorLinks' | 'slideTen'

export type ArcadeShareResult = {
  kind: 'arcade'
  gameId: ArcadeGameId
  locale: 'zh-Hant' | 'en'
  gameName: string
  headline: string
  metricLabel: string
  value: string
  unit: string
  score: number
  stats: { label: string; value: string }[]
  newBest: boolean
  playedAt: Date
  pageUrl: string
  comparison?: { target: number; actual: number }
}

export type ShareResult = LegacyShareResult | ArcadeShareResult

export type ShareActionResult = 'shared' | 'cancelled' | 'unavailable' | 'failed'
