import { getModeHintLimit, getModeRoundSeconds, PLAYABLE_MODE_DETAILS, PLAYABLE_MODES } from '../game/modes'
import type { PlayableMode } from '../game/modes'
import type { GameSettings, GameStatistics } from '../game/types'
import { InstallAppButton } from './InstallAppButton'
import { StatisticsPanel } from './StatisticsPanel'

type StartScreenProps = {
  selectedMode: PlayableMode
  onModeChange: (mode: PlayableMode) => void
  onStart: () => void
  settings: GameSettings
  statistics: GameStatistics
  onOpenSettings: () => void
  onHowToPlay: () => void
  onAbout: () => void
  install: React.ComponentProps<typeof InstallAppButton>
}

export function StartScreen({ selectedMode, onModeChange, onStart, settings, statistics, onOpenSettings, onHowToPlay, onAbout, install }: StartScreenProps) {
  const selectedDetails = PLAYABLE_MODE_DETAILS[selectedMode]
  return <section className="start-screen">
    <div className="brand-lockup"><span className="brand-mark" aria-hidden="true">✦</span><span>Orchard Ten</span></div>
    <p className="eyebrow">A SMALL SUM PUZZLE</p>
    <h1>框選數字，<br />湊成 <em>10</em>。</h1>
    <p className="intro">選一種節奏，在時間結束前消除最多水果。</p>
    <div className="mode-picker" role="radiogroup" aria-label="選擇遊戲模式">
      {PLAYABLE_MODES.map((mode, index) => {
        const details = PLAYABLE_MODE_DETAILS[mode]
        const selected = mode === selectedMode
        return <label key={mode} className={`mode-option mode-${mode}${selected ? ' is-selected' : ''}`}>
          <input type="radio" name="game-mode" value={mode} checked={selected} onChange={() => onModeChange(mode)} />
          <span className="mode-index">0{index + 1}</span>
          <strong>{details.label}</strong>
          <span className="mode-meta">{getModeRoundSeconds(mode)} 秒 · {getModeHintLimit(mode)} 次提示</span>
          <small>{details.description}</small>
        </label>
      })}
    </div>
    <div className="score-snapshot"><span>{selectedDetails.label}最高分 <strong>{statistics.highScore}</strong></span><span>上次分數 <strong>{statistics.lastScore}</strong></span></div>
    <button type="button" className="primary-button" onClick={onStart}>開始{selectedDetails.label}模式 <span aria-hidden="true">→</span></button>
    <div className="start-links"><button type="button" className="text-button" onClick={onHowToPlay}>玩法說明</button><button type="button" className="text-button" onClick={onOpenSettings}>設定 {settings.soundEnabled ? '· 音效開啟' : '· 靜音'}</button><InstallAppButton {...install} /><button type="button" className="text-button" onClick={onAbout}>About</button></div>
    <StatisticsPanel statistics={statistics} modeLabel={selectedDetails.label} />
    <p className="credit-note">核心玩法靈感來自 <a href="https://en.gamesaien.com/game/fruit_box/" target="_blank" rel="noopener noreferrer">Fruit Box</a>，以原創介面與互動重新製作。</p>
  </section>
}
