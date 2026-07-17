import { useEffect, useMemo, useRef, useState } from 'react'
import { COMBO_WINDOW_MS, HINT_DURATION_MS, SCORE_MILESTONES, TARGET_SUM } from '../game/constants'
import type { GameAction } from '../game/gameReducer'
import { getModeHintLimit, PLAYABLE_MODE_DETAILS } from '../game/modes'
import { playHarvestSound, playInvalidSound } from '../game/soundManager'
import type { GameSettings, GameState, GridRect } from '../game/types'
import { findValidMove, selectHintMove } from '../game/validMoveFinder'
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
  const autoReshuffledBoard = useRef<GameState['board'] | null>(null)
  const paused = game.status === 'paused'
  const interactive = game.status === 'playing' && !tutorialOpen
  const hintLimit = getModeHintLimit(game.mode)
  const modeDetails = PLAYABLE_MODE_DETAILS[game.mode]
  const validMove = useMemo(() => game.status === 'playing' ? findValidMove(game.board) : null, [game.board, game.status])
  const remainingFruit = useMemo(() => game.board.flat().filter((value) => value !== null).length, [game.board])
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

  useEffect(() => {
    if (!interactive || validMove || remainingFruit < 2 || autoReshuffledBoard.current === game.board) return
    autoReshuffledBoard.current = game.board
    setHint(null)
    setMessage('棋盤已無可行組合，系統正在免費自動重排。')
    dispatch({ type: 'reshuffle' })
  }, [dispatch, game.board, interactive, remainingFruit, validMove])

  const handleSelection = (rect: GridRect, sum: number) => {
    if (!interactive) return
    const success = sum === TARGET_SUM
    if (success) {
      playHarvestSound(settings.soundEnabled, settings.volume)
      setMessage('成功消除！分數依消除水果數增加，Combo 繼續累積。')
    } else {
      playInvalidSound(settings.soundEnabled, settings.volume)
      setMessage(sum > TARGET_SUM ? `總和 ${sum}，超過 ${sum - TARGET_SUM}；Combo 已中斷。` : `總和 ${sum}，還差 ${TARGET_SUM - sum}；再試一次。`)
    }
    dispatch({ type: 'select', rect, now: Date.now() })
  }

  const useHint = () => {
    if (!interactive) return
    if (!validMove) {
      setMessage('目前沒有可消除組合，系統正在自動重排。')
      return
    }
    setHint(selectHintMove(game.board))
    dispatch({ type: 'use-hint' })
    setMessage('提示已顯示，試著框選發亮的區域。')
  }

  const comboLevel = SCORE_MILESTONES.includes(game.combo as typeof SCORE_MILESTONES[number]) ? ' is-milestone' : ''

  return (
    <section className="play-screen" inert={paused} aria-hidden={paused}>
      <header className="play-topbar">
        <div className="play-identity"><div className="brand-lockup"><span className="brand-mark" aria-hidden="true">✦</span><span>Orchard Ten</span></div><span className={`mode-chip mode-${game.mode}`}>{modeDetails.label} · {modeDetails.englishLabel}</span></div>
        <div><button type="button" className="text-button compact" disabled={paused} onClick={onOpenSettings}>設定</button><button type="button" className="text-button compact" disabled={paused} onClick={onRestart}>重新開始</button></div>
      </header>
      <section className="hud" aria-label="遊戲資訊">
        <div><span>分數</span><strong>{String(game.score).padStart(3, '0')}</strong></div>
        <div className="hud-combo"><span>Combo</span><strong className={comboLevel}>{game.combo} <small>最高 {game.bestCombo}</small></strong><i className={game.combo > 0 ? '' : 'is-idle'} style={{ '--combo-progress': `${game.combo > 0 ? (comboRemaining / COMBO_WINDOW_MS) * 100 : 0}%` } as React.CSSProperties} aria-label={game.combo > 0 ? 'Combo 剩餘時間' : undefined} aria-hidden={game.combo === 0} /></div>
        <div className="timer"><span>時間</span><Timer seconds={game.secondsLeft} urgent={game.secondsLeft <= 10} /></div>
        <button type="button" className="icon-button" aria-label="暫停遊戲" disabled={!interactive} onClick={onPause}>Ⅱ</button>
      </section>
      {game.status === 'playing' ? <>
        <div className="board-actions"><button type="button" className="quiet-button" disabled={!interactive || !validMove || game.hintsUsed >= hintLimit} onClick={useHint}>提示 {hintLimit - game.hintsUsed}/{hintLimit}</button><span>{validMove ? '找到可行組合' : remainingFruit >= 2 ? '偵測到無解，正在自動重排' : '剩餘水果不足以組成矩形'}</span></div>
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
