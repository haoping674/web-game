import { useEffect, useState } from 'react'
import { TARGET_SUM } from '../game/constants'
import type { GameAction } from '../game/gameReducer'
import type { GameState, GridRect } from '../game/types'
import { GameBoard } from './GameBoard'
import { Timer } from './Timer'
import { SettingsPanel } from './SettingsPanel'
import { playHarvestSound } from '../game/soundManager'
type GameScreenProps = { game: GameState; dispatch: React.Dispatch<GameAction>; soundEnabled: boolean; lowStimulus: boolean; onToggleSound: () => void; onToggleLowStimulus: () => void }
export function GameScreen({ game, dispatch, soundEnabled, lowStimulus, onToggleSound, onToggleLowStimulus }: GameScreenProps) {
  const [message, setMessage] = useState('拖曳框選水果，湊出 10。')
  useEffect(() => { if (game.status !== 'playing') return undefined; const timer = window.setInterval(() => dispatch({ type: 'tick' }), 1000); return () => window.clearInterval(timer) }, [dispatch, game.status])
  const handleSelection = (rect: GridRect, sum: number) => { if (sum === TARGET_SUM) playHarvestSound(soundEnabled); setMessage(sum === TARGET_SUM ? '收成成功！' : `總和是 ${sum}，再換個框法。`); dispatch({ type: 'select', rect }) }
  return <section className="play-screen"><header className="play-topbar"><div className="brand-lockup"><span className="brand-mark" aria-hidden="true">✦</span><span>果粒十格</span></div><button type="button" className="text-button compact" onClick={() => dispatch({ type: 'restart' })}>重新開始</button></header><section className="hud" aria-label="遊戲資訊"><div><span>分數</span><strong>{String(game.score).padStart(3, '0')}</strong></div><div className="timer"><span>倒數</span><Timer seconds={game.secondsLeft} urgent={game.secondsLeft <= 10} /></div><button type="button" className="icon-button" aria-label="暫停遊戲" onClick={() => dispatch({ type: 'pause' })}>Ⅱ</button></section><GameBoard board={game.board} onSelectionEnd={handleSelection} disabled={game.status !== 'playing'} /><p className="selection-status" aria-live="polite">{message}</p><SettingsPanel soundEnabled={soundEnabled} lowStimulus={lowStimulus} onToggleSound={onToggleSound} onToggleLowStimulus={onToggleLowStimulus} /></section>
}
