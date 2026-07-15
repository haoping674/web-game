import { useEffect, useMemo, useState } from 'react'
import { COMBO_WINDOW_MS, HINT_DURATION_MS, HINT_LIMIT, SCORE_MILESTONES, TARGET_SUM } from '../game/constants'
import type { GameAction } from '../game/gameReducer'
import type { GameSettings, GameState, GridRect } from '../game/types'
import { findValidMove } from '../game/validMoveFinder'
import { GameBoard } from './GameBoard'
import { Timer } from './Timer'
import { playHarvestSound, playInvalidSound } from '../game/soundManager'

type GameScreenProps = { game: GameState; dispatch: React.Dispatch<GameAction>; settings: GameSettings; tutorialOpen: boolean; onOpenSettings: () => void }
export function GameScreen({ game, dispatch, settings, tutorialOpen, onOpenSettings }: GameScreenProps) {
  const [message, setMessage] = useState('拖曳框選水果，讓總和剛好是 10。')
  const [hint, setHint] = useState<GridRect | null>(null)
  const validMove = useMemo(() => findValidMove(game.board), [game.board])
  const comboRemaining = game.comboDeadline === null ? 0 : Math.max(0, game.comboDeadline - Date.now())
  useEffect(() => {
    if (game.status !== 'playing' || tutorialOpen) return undefined
    const timer = window.setInterval(() => dispatch({ type: 'tick', now: Date.now() }), 1000)
    return () => window.clearInterval(timer)
  }, [dispatch, game.status, tutorialOpen])
  useEffect(() => { if (!hint) return undefined; const timer = window.setTimeout(() => setHint(null), HINT_DURATION_MS); return () => window.clearTimeout(timer) }, [hint])
  const handleSelection = (rect: GridRect, sum: number) => {
    const success = sum === TARGET_SUM
    if (success) { playHarvestSound(settings.soundEnabled, settings.volume); setMessage('成功消除！分數與 Combo 都在成長。') }
    else { playInvalidSound(settings.soundEnabled, settings.volume); setMessage(sum > TARGET_SUM ? `總和 ${sum}，超過 ${sum - TARGET_SUM}；Combo 已中斷。` : `總和 ${sum}，還差 ${TARGET_SUM - sum}；再試一次。`) }
    dispatch({ type: 'select', rect, now: Date.now() })
  }
  const useHint = () => {
    if (!validMove) { setMessage('目前沒有可消除組合。可以重新排列剩餘水果。'); return }
    setHint(validMove); dispatch({ type: 'use-hint' }); setMessage('提示已顯示，試著框選發亮的區域。')
  }
  const comboLevel = SCORE_MILESTONES.includes(game.combo as typeof SCORE_MILESTONES[number]) ? ' is-milestone' : ''
  return <section className="play-screen"><header className="play-topbar"><div className="brand-lockup"><span className="brand-mark" aria-hidden="true">✦</span><span>Orchard Ten</span></div><div><button type="button" className="text-button compact" onClick={onOpenSettings}>設定</button><button type="button" className="text-button compact" onClick={() => dispatch({ type: 'restart' })}>重新開始</button></div></header><section className="hud" aria-label="遊戲資訊"><div><span>分數</span><strong>{String(game.score).padStart(3, '0')}</strong></div><div className="hud-combo"><span>Combo</span><strong className={comboLevel}>{game.combo} <small>最高 {game.bestCombo}</small></strong>{game.combo > 0 && <i style={{ '--combo-progress': `${(comboRemaining / COMBO_WINDOW_MS) * 100}%` } as React.CSSProperties} aria-label="Combo 剩餘時間" />}</div><div className="timer"><span>時間</span><Timer seconds={game.secondsLeft} urgent={game.secondsLeft <= 10} /></div><button type="button" className="icon-button" aria-label="暫停遊戲" onClick={() => dispatch({ type: 'pause', now: Date.now() })}>Ⅱ</button></section><div className="board-actions"><button type="button" className="quiet-button" disabled={game.hintsUsed >= HINT_LIMIT} onClick={useHint}>提示 {HINT_LIMIT - game.hintsUsed}/{HINT_LIMIT}</button>{!validMove && <button type="button" className="quiet-button" onClick={() => { dispatch({ type: 'reshuffle' }); setMessage('已重新排列未消除的水果。') }}>重新排列</button>}<span>{validMove ? '找到可行組合' : '暫時沒有可行組合'}</span></div><GameBoard board={game.board} onSelectionEnd={handleSelection} disabled={game.status !== 'playing' || tutorialOpen} hint={hint} animationsEnabled={settings.animationsEnabled} /><p className="selection-status" aria-live="polite">{message}</p>{settings.showSelectionHelp && <p className="shortcut-tip">拖曳可框選；鍵盤可用方向鍵移動，按 Enter 設定矩形兩端。</p>}</section>
}
