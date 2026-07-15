import { SettingsPanel } from './SettingsPanel'
type StartScreenProps = { onStart: () => void; highScore: number; soundEnabled: boolean; lowStimulus: boolean; onToggleSound: () => void; onToggleLowStimulus: () => void }

export function StartScreen({ onStart, highScore, soundEnabled, lowStimulus, onToggleSound, onToggleLowStimulus }: StartScreenProps) {
  return <section className="start-screen"><div className="brand-lockup"><span className="brand-mark" aria-hidden="true">✦</span><span>果粒十格</span></div><p className="eyebrow">ORCHARD TEN · 數字果園</p><h1>每一框，<br />剛好 <em>10</em> 分甜。</h1><p className="intro">拖曳框選水果，讓所有數字的總和剛好是 10。兩分鐘內收成越多，分數越高。</p><p className="high-score">最高收成 <strong>{highScore}</strong></p><button type="button" className="primary-button" onClick={onStart}>開始收成 <span aria-hidden="true">→</span></button><p className="shortcut-tip">提示：點選單一水果也能試試手氣。</p><SettingsPanel soundEnabled={soundEnabled} lowStimulus={lowStimulus} onToggleSound={onToggleSound} onToggleLowStimulus={onToggleLowStimulus} /></section>
}
