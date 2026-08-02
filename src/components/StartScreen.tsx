import { getModeHintLimit, getModeRoundSeconds, PLAYABLE_MODE_DETAILS } from '../game/modes'
import type { GameSettings, GameStatistics } from '../game/types'
import { InstallAppButton } from './InstallAppButton'
import { StatisticsPanel } from './StatisticsPanel'

type StartScreenProps = {
  onStart: () => void
  settings: GameSettings
  statistics: GameStatistics
  onOpenSettings: () => void
  onHowToPlay: () => void
  onAbout: () => void
  install: React.ComponentProps<typeof InstallAppButton>
}

export function StartScreen({ onStart, settings, statistics, onOpenSettings, onHowToPlay, onAbout, install }: StartScreenProps) {
  const classic = PLAYABLE_MODE_DETAILS.classic
  return <section className="start-screen">
    <div className="brand-lockup"><span className="brand-mark" aria-hidden="true">✦</span><span>Orchard Ten</span></div>
    <p className="eyebrow">A SMALL SUM PUZZLE</p>
    <h1>框選相鄰數字，<br />湊成 <em>10</em>！</h1>
    <p className="intro">在倒數結束前找出總和為 10 的矩形，盡可能連續消除水果。</p>
    <p className="mode-summary"><strong>{classic.label}模式</strong> · {getModeRoundSeconds('classic')} 秒 · {getModeHintLimit('classic')} 次提示</p>
    <div className="score-snapshot"><span>{classic.label}最高分 <strong>{statistics.highScore}</strong></span><span>上次分數 <strong>{statistics.lastScore}</strong></span></div>
    <button type="button" className="primary-button" onClick={onStart}>開始{classic.label}模式 <span aria-hidden="true">→</span></button>
    <div className="start-links"><button type="button" className="text-button" onClick={onHowToPlay}>玩法說明</button><button type="button" className="text-button" onClick={onOpenSettings}>設定 {settings.soundEnabled ? '· 音效開啟' : '· 靜音'}</button><InstallAppButton {...install} /><button type="button" className="text-button" onClick={onAbout}>About</button></div>
    <StatisticsPanel statistics={statistics} modeLabel={classic.label} />
    <p className="credit-note">玩法靈感來自 <a href="https://en.gamesaien.com/game/fruit_box/" target="_blank" rel="noopener noreferrer">Fruit Box</a>，以原創的程式架構、介面與互動重新實作。</p>
  </section>
}
