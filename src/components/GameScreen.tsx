import { useEffect, useMemo, useState } from 'react'
import { COMBO_WINDOW_MS, HINT_DURATION_MS, HINT_LIMIT, SCORE_MILESTONES, TARGET_SUM } from '../game/constants'
import type { GameAction } from '../game/gameReducer'
import { playHarvestSound, playInvalidSound } from '../game/soundManager'
import type { GameSettings, GameState, GridRect } from '../game/types'
import { findValidMove } from '../game/validMoveFinder'
import type { NetworkNotice } from '../hooks/useNetworkStatus'
import { GameBoard } from './GameBoard'
import { NetworkStatusToast } from './NetworkStatusToast'
import { PausedBoardPlaceholder } from './PausedBoardPlaceholder'
import { Timer } from './Timer'

type GameScreenProps = {
  game: GameState
  dispatch: React.Dispatch<GameAction>
  settings: GameSettings
  tutorialOpen: boolean
  onPause: () => void
  onRestart: () => void
  onOpenSettings: () => void
  networkNotice: NetworkNotice
}

export function GameScreen({ game, dispatch, settings, tutorialOpen, onPause, onRestart, onOpenSettings, networkNotice }: GameScreenProps) {
  const [message, setMessage] = useState('拖曳框選水果，讓總和剛好是 10。')
  const [hint, setHint] = useState<GridRect | null>(null)
  const paused = game.status === 'paused'
  const interactive = game.status === 'playing' && !tutorialOpen
  const validMove = useMemo(() => game.status === 'playing' ? findValidMove(game.board) : null, [game.board, game.status])
  const comboRemaining = game.comboDeadline === null
    ? 0
    : Math.max(0, game.status === 'paused' ? game.comboDeadline : game.comboDeadline - Date.now())

  useEffect(() => {
    if (!interactive || game.nextTickAt === null) return undefined
    const delay = Math.max(0, game.nextTickAt - Date.now())
    const timer = window.setTimeout(() => dispatch({ type: 'tick', now: Date.now() }), delay)
    return () => window.clearTimeout(timer)
  }, [dispatch, game.nextTickAt, interactive])

  useEffect(() => {
    if (!interactive) setHint(null)
  }, [interactive])

  useEffect(() => {
    if (!hint || !interactive) return undefined
    const timer = window.setTimeout(() => setHint(null), HINT_DURATION_MS)
    return () => window.clearTimeout(timer)
  }, [hint, interactive])

  const handleSelection = (rect: GridRect, sum: number) => {
    if (!interactive) return
    const success = sum === TARGET_SUM
    if (success) {
      playHarvestSound(settings.soundEnabled, settings.volume)
      setMessage('成功消除！分數與 Combo 都在成長。')
    } else {
      playInvalidSound(settings.soundEnabled, settings.volume)
      setMessage(sum > TARGET_SUM ? `總和 ${sum}，超過 ${sum - TARGET_SUM}；Combo 已中斷。` : `總和 ${sum}，還差 ${TARGET_SUM - sum}；再試一次。`)
    }
    dispatch({ type: 'select', rect, now: Date.now() })
  }

  const useHint = () => {
    if (!interactive) return
    if (!validMove) {
      setMessage('目前沒有可消除組合。可以重新排列剩餘水果。')
      return
    }
    setHint(validMove)
    dispatch({ type: 'use-hint' })
    setMessage('提示已顯示，試著框選發亮的區域。')
  }

  const reshuffle = () => {
    if (!interactive) return
    dispatch({ type: 'reshuffle' })
    setMessage('已重新排列未消除的水果。')
  }

  const comboLevel = SCORE_MILESTONES.includes(game.combo as typeof SCORE_MILESTONES[number]) ? ' is-milestone' : ''

  return (
    <section className="play-screen" inert={paused} aria-hidden={paused}>
      <header className="play-topbar">
        <div className="brand-lockup"><span className="brand-mark" aria-hidden="true">✦</span><span>Orchard Ten</span></div>
        <div><button type="button" className="text-button compact" onClick={onOpenSettings}>設定</button><button type="button" className="text-button compact" onClick={onRestart}>重新開始</button></div>
      </header>
      <section className="hud" aria-label="遊戲資訊">
        <div><span>分數</span><strong>{String(game.score).padStart(3, '0')}</strong></div>
        <div className="hud-combo"><span>Combo</span><strong className={comboLevel}>{game.combo} <small>最高 {game.bestCombo}</small></strong><i className={game.combo > 0 ? '' : 'is-idle'} style={{ '--combo-progress': `${game.combo > 0 ? (comboRemaining / COMBO_WINDOW_MS) * 100 : 0}%` } as React.CSSProperties} aria-label={game.combo > 0 ? 'Combo 剩餘時間' : undefined} aria-hidden={game.combo === 0} /></div>
        <div className="timer"><span>時間</span><Timer seconds={game.secondsLeft} urgent={game.secondsLeft <= 10} /></div>
        <button type="button" className="icon-button" aria-label="暫停遊戲" disabled={!interactive} onClick={onPause}>Ⅱ</button>
      </section>
      {game.status === 'playing' ? <>
        <div className="board-actions"><button type="button" className="quiet-button" disabled={!interactive || game.hintsUsed >= HINT_LIMIT} onClick={useHint}>提示 {HINT_LIMIT - game.hintsUsed}/{HINT_LIMIT}</button>{!validMove && <button type="button" className="quiet-button" disabled={!interactive} onClick={reshuffle}>重新排列</button>}<span>{validMove ? '找到可行組合' : '暫時沒有可行組合'}</span></div>
        <NetworkStatusToast notice={networkNotice} inline />
        <GameBoard board={game.board} onSelectionEnd={handleSelection} disabled={!interactive} hint={hint} animationsEnabled={settings.animationsEnabled} />
        <p className="selection-status" aria-live="polite">{message}</p>
        {settings.showSelectionHelp && <p className="shortcut-tip">拖曳可框選；鍵盤可用方向鍵移動，按 Enter 設定矩形兩端。</p>}
      </> : paused ? <>
        <NetworkStatusToast notice={networkNotice} inline />
        <PausedBoardPlaceholder />
      </> : <GameBoard board={game.board} disabled animationsEnabled={settings.animationsEnabled} />}
    </section>
  )
}
