import { useEffect, useMemo, useRef, useState } from 'react'
import { getComboConfig, getComboWindowMs } from '../game/comboConfig'
import { createComboClearEffect, resolveEffectLevel, type ComboClearEffect } from '../game/comboEffects'
import { getNextGameWakeDelay } from '../game/comboTimer'
import { getComboRating, getComboTier, getComboTitle, isComboMilestone } from '../game/comboTier'
import { HINT_DURATION_MS, TARGET_SUM } from '../game/constants'
import type { GameAction } from '../game/gameReducer'
import { getModeHintLimit, PLAYABLE_MODE_DETAILS } from '../game/modes'
import { getRectangleCells } from '../game/selectionCalculator'
import { playComboBreakSound, playComboSound, playInvalidSound, stopComboAudio, triggerHaptic } from '../game/soundManager'
import type { GameSettings, GameState, GridRect } from '../game/types'
import { findValidMove, selectHintMove } from '../game/validMoveFinder'
import type { NetworkNotice } from '../hooks/useNetworkStatus'
import { GameBoard } from './GameBoard'
import { ComboIndicator } from './ComboIndicator'
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
  showMobileGestureHint?: boolean
  onMobileGestureHintShown?: () => void
}

function usePrefersReducedMotion(): boolean {
  const query = '(prefers-reduced-motion: reduce)'
  const [reduced, setReduced] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const media = window.matchMedia(query)
    const update = () => setReduced(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return reduced
}

export function GameScreen({ game, dispatch, settings, tutorialOpen, onPause, onRestart, onOpenSettings, networkNotice, showMobileGestureHint = false, onMobileGestureHintShown }: GameScreenProps) {
  const [message, setMessage] = useState('拖曳框選水果，讓總和剛好是 10。')
  const [hint, setHint] = useState<GridRect | null>(null)
  const [clearEffect, setClearEffect] = useState<ComboClearEffect | null>(null)
  const [gestureHintVisible, setGestureHintVisible] = useState(false)
  const effectId = useRef(0)
  const previousCombo = useRef(game.combo)
  const gestureHintHandled = useRef(false)
  const autoReshuffledBoard = useRef<GameState['board'] | null>(null)
  const paused = game.status === 'paused'
  const interactive = game.status === 'playing' && !tutorialOpen
  const hintLimit = getModeHintLimit(game.mode)
  const modeDetails = PLAYABLE_MODE_DETAILS[game.mode]
  const comboModeConfig = getComboConfig(game.mode)
  const prefersReducedMotion = usePrefersReducedMotion()
  const effectLevel = resolveEffectLevel(settings, prefersReducedMotion)
  const validMove = useMemo(() => game.status === 'playing' ? findValidMove(game.board) : null, [game.board, game.status])
  const remainingFruit = useMemo(() => game.board.flat().filter((value) => value !== null).length, [game.board])

  useEffect(() => {
    if (previousCombo.current > 0 && game.combo === 0 && game.status === 'playing') {
      playComboBreakSound(settings.soundEnabled, settings.volume)
      setClearEffect(null)
    }
    previousCombo.current = game.combo
    if (game.status !== 'playing') stopComboAudio()
  }, [game.combo, game.status, settings.soundEnabled, settings.volume])

  useEffect(() => () => stopComboAudio(), [])

  useEffect(() => {
    if (!interactive) return undefined
    const now = Date.now()
    const delay = getNextGameWakeDelay(game.nextTickAt, game.comboDeadline, now)
    if (delay === null) return undefined
    const timer = window.setTimeout(() => dispatch({ type: 'tick', now: Date.now() }), delay)
    return () => window.clearTimeout(timer)
  }, [dispatch, game.comboDeadline, game.nextTickAt, interactive])

  useEffect(() => {
    if (!interactive) setHint(null)
  }, [interactive])

  useEffect(() => {
    if (game.successfulMoves === 0) setClearEffect(null)
  }, [game.successfulMoves])

  useEffect(() => {
    if (!interactive || !showMobileGestureHint || gestureHintHandled.current) return undefined
    const isCoarsePointer = window.matchMedia('(hover: none) and (pointer: coarse), (any-pointer: coarse)').matches
    if (!isCoarsePointer) return undefined
    gestureHintHandled.current = true
    setGestureHintVisible(true)
    onMobileGestureHintShown?.()
    return undefined
  }, [interactive, onMobileGestureHintShown, showMobileGestureHint])

  useEffect(() => {
    if (!gestureHintVisible) return undefined
    const timer = window.setTimeout(() => setGestureHintVisible(false), 5_200)
    return () => window.clearTimeout(timer)
  }, [gestureHintVisible])

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
      const now = Date.now()
      const combo = game.comboDeadline !== null && now <= game.comboDeadline ? game.combo + 1 : 1
      const tier = getComboTier(combo)
      const previousDuration = getComboWindowMs(game.mode, Math.max(1, game.combo))
      const remainingRatio = game.comboDeadline === null ? 0 : Math.max(0, game.comboDeadline - now) / previousDuration
      const rating = getComboRating({ combo, remainingRatio, validSuccess: true })
      const clearedCells = getRectangleCells(rect).filter(({ row, column }) => game.board[row]?.[column] !== null)
      const points = clearedCells.length
      effectId.current += 1
      setClearEffect(createComboClearEffect(effectId.current, rect, clearedCells, combo, points, comboModeConfig, tier, rating, isComboMilestone(combo)))
      playComboSound({ enabled: settings.soundEnabled, volume: settings.volume, combo, lowStimulus: settings.lowStimulus })
      triggerHaptic(settings.hapticsEnabled, combo, settings.lowStimulus)
      const title = getComboTitle(combo)
      setMessage(title ? `${title}！Combo ${combo}，節奏持續累積。` : `成功消除！Combo ${combo}，繼續保持節奏。`)
      dispatch({ type: 'select', rect, now })
      return
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

  return (
    <section className="play-screen" inert={paused} aria-hidden={paused}>
      <header className="play-topbar">
        <div className="play-identity"><div className="brand-lockup"><span className="brand-mark" aria-hidden="true">✦</span><span>Orchard Ten</span></div><span className={`mode-chip mode-${game.mode}`}>{modeDetails.label} · {modeDetails.englishLabel}</span></div>
        <div><button type="button" className="text-button compact" disabled={paused} onClick={onOpenSettings}>設定</button><button type="button" className="text-button compact" disabled={paused} onClick={onRestart}>重新開始</button></div>
      </header>
      <section className="hud" aria-label="遊戲資訊">
        <div><span>分數</span><strong>{String(game.score).padStart(3, '0')}</strong></div>
        <ComboIndicator combo={game.combo} bestCombo={game.bestCombo} comboDeadline={game.comboDeadline} status={game.status} mode={game.mode} />
        <div className="timer"><span>時間</span><Timer seconds={game.secondsLeft} urgent={game.secondsLeft <= 10} /></div>
        <button type="button" className="icon-button" aria-label="暫停遊戲" disabled={!interactive} onClick={onPause}>Ⅱ</button>
      </section>
      {game.status === 'playing' ? <>
        <div className="board-actions"><button type="button" className="quiet-button" disabled={!interactive || !validMove || game.hintsUsed >= hintLimit} onClick={useHint}>提示 {hintLimit - game.hintsUsed}/{hintLimit}</button><span>{validMove ? '找到可行組合' : remainingFruit >= 2 ? '偵測到無解，正在自動重排' : '剩餘水果不足以組成矩形'}</span></div>
        <NetworkStatusToast notice={networkNotice} inline />
        {gestureHintVisible ? <p className="mobile-gesture-hint" role="status">棋盤內單指框選，雙指可移動畫面。</p> : null}
        <GameBoard board={game.board} onSelectionEnd={handleSelection} disabled={!interactive} hint={hint} clearEffect={clearEffect} effectLevel={effectLevel} combo={game.combo} />
        <p className="selection-status" aria-live="polite">{message}</p>
        {settings.showSelectionHelp && <p className="shortcut-tip">拖曳可框選；鍵盤可用方向鍵移動，按 Enter 設定矩形兩端。</p>}
      </> : paused ? <>
        <NetworkStatusToast notice={networkNotice} inline />
        <PausedBoardPlaceholder />
      </> : <GameBoard board={game.board} disabled effectLevel={effectLevel} />}
    </section>
  )
}
