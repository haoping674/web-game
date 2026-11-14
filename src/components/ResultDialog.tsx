import { useMemo } from 'react'
import type { GameState, GameStatistics } from '../game/types'
import type { ArcadeShareResult } from '../share/types'
import { fruitShareResult } from '../share/arcadeResults'
import { ArcadeResultDialog } from './ArcadeResultDialog'
import { LeaderboardPanel } from '../shared/leaderboard/LeaderboardPanel'

type ResultDialogProps = {
  game: GameState
  statistics: GameStatistics
  onRestart: () => void
  onHome: () => void
  result?: ArcadeShareResult
}

export function ResultDialog({ game, statistics, onRestart, onHome, result }: ResultDialogProps) {
  const fallback = useMemo(() => fruitShareResult(game, game.score > statistics.highScore), [game, statistics.highScore])
  return <ArcadeResultDialog result={result ?? fallback} onReplay={onRestart} onHome={onHome}>
    <LeaderboardPanel board="fruit-classic" score={game.score} />
  </ArcadeResultDialog>
}
