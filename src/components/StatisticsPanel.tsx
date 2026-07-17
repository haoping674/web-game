import type { GameStatistics } from '../game/types'

type StatisticsPanelProps = { statistics: GameStatistics; modeLabel: string }

export function StatisticsPanel({ statistics, modeLabel }: StatisticsPanelProps) {
  const average = statistics.gamesPlayed ? Math.round((statistics.totalScore / statistics.gamesPlayed) * 10) / 10 : 0
  return <section className="statistics-panel" aria-label={`${modeLabel}模式遊戲統計`}><span>{modeLabel.toUpperCase()} RECORD</span><dl><div><dt>局數</dt><dd>{statistics.gamesPlayed}</dd></div><div><dt>平均分</dt><dd>{average}</dd></div><div><dt>總消除</dt><dd>{statistics.totalCleared}</dd></div><div><dt>最高 Combo</dt><dd>{statistics.highestCombo}</dd></div><div><dt>最高每分鐘</dt><dd>{statistics.bestClearsPerMinute}</dd></div></dl></section>
}
