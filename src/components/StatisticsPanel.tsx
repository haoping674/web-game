import type { GameStatistics } from '../game/types'
type StatisticsPanelProps = { statistics: GameStatistics }
export function StatisticsPanel({ statistics }: StatisticsPanelProps) {
  const average = statistics.gamesPlayed ? Math.round((statistics.totalScore / statistics.gamesPlayed) * 10) / 10 : 0
  return <section className="statistics-panel" aria-label="遊戲紀錄"><span>遊戲紀錄</span><dl><div><dt>遊玩</dt><dd>{statistics.gamesPlayed}</dd></div><div><dt>平均</dt><dd>{average}</dd></div><div><dt>已消除</dt><dd>{statistics.totalCleared}</dd></div><div><dt>最高 Combo</dt><dd>{statistics.highestCombo}</dd></div><div><dt>最佳／分</dt><dd>{statistics.bestClearsPerMinute}</dd></div></dl></section>
}
