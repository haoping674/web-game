import { ArcadeResultDialog } from '../../components/ArcadeResultDialog'
import { colorShareResult } from '../../share/arcadeResults'
import type { ArcadeShareResult } from '../../share/types'
import { translate } from '../../app/translate'
import { useBoardCentering } from '../../hooks/useBoardCentering'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { OverlayDialog } from '../../components/OverlayDialog'
import { useGameActivity } from '../../hooks/useGameActivity'
import { Timer } from '../../components/Timer'
import { getCountdownPhase } from '../../components/countdown'
import { useGamePauseShortcut } from '../../hooks/useGamePauseShortcut'
import { usePageVisibilityPause } from '../../hooks/usePageVisibilityPause'
import {
  markGameTutorialSeen,
  readAppStorage,
  recordColorLinksResult,
  type GlobalSettings,
} from '../../shared/storage/appStorage'
import { ColorLinksAudio } from './audio'
import {
  findAllValidMoves,
  findMatchesAtCell,
  generateBoard,
  reshuffleRemainingTiles,
} from './board'
import { COLOR_LINKS_CONFIG } from './config'
import {
  calculateColorLinkScore,
  colorLinksReducer,
  createColorLinksState,
} from './gameReducer'
import { ColorLinksBoard, type ColorLinksEffect } from './ColorLinksBoard'
import { ColorLinksTutorialDialog } from './ColorLinksTutorialDialog'
import type { CellPosition, MatchGroup } from './types'
import { LeaderboardPanel } from '../../shared/leaderboard/LeaderboardPanel'

type ColorLinksGameProps = {
  globalSettings: GlobalSettings
  onProgressChange: () => void
  platformSettingsOpen: boolean
}

function totalDirections(matches: readonly MatchGroup[]): number {
  return matches.reduce((total, match) => total + match.tiles.length, 0)
}

function formatElapsedTime(seconds: number | undefined): string {
  if (seconds === undefined) return '--:--'
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

function remainingSeconds(elapsedSeconds: number): number {
  return Math.max(0, COLOR_LINKS_CONFIG.timeLimitSeconds - elapsedSeconds)
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

export default function ColorLinksGame({
  globalSettings,
  onProgressChange,
  platformSettingsOpen,
}: ColorLinksGameProps) {
  const [game, dispatch] = useReducer(colorLinksReducer, undefined, () => createColorLinksState())
  const [feedback, setFeedback] = useState(translate('點擊空格，連結兩個以上同色訊號。'))
  const [effect, setEffect] = useState<ColorLinksEffect | null>(null)
  const [invalidCell, setInvalidCell] = useState<CellPosition | null>(null)
  const [bestTimeSeconds, setBestTimeSeconds] = useState(() => readAppStorage().games.colorLinks.bestTimeSeconds)
  const [roundResult, setRoundResult] = useState<ArcadeShareResult | null>(null)
  const [tutorialOpen, setTutorialOpen] = useState(false)
  const [tutorialSeen, setTutorialSeen] = useState(() => readAppStorage().games.colorLinks.tutorialSeen === true)
  const effectId = useRef(0)
  const effectTimer = useRef<number | null>(null)
  const invalidTimer = useRef<number | null>(null)
  const lastInput = useRef<{ key: string; at: number } | null>(null)
  const recorded = useRef(false)
  const audio = useRef<ColorLinksAudio | null>(null)
  const prefersReducedMotion = usePrefersReducedMotion()
  const reducedMotion =
    prefersReducedMotion
    || globalSettings.reducedMotion
    || globalSettings.effectIntensity !== 'full'
  const { containerRef, centerBoard } = useBoardCentering<HTMLElement>(reducedMotion)
  const effectsOff = globalSettings.effectIntensity === 'off'
  const validMoves = useMemo(() => findAllValidMoves(game.board), [game.board])
  const remainingTiles = useMemo(
    () => game.board.reduce((total, row) => total + row.filter((cell) => cell !== null).length, 0),
    [game.board],
  )
  const playing = game.status === 'playing'
  const paused = game.status === 'paused'
  useGameActivity(playing || paused)
  const timeRemaining = remainingSeconds(game.elapsedSeconds)

  const getAudio = () => {
    audio.current ??= new ColorLinksAudio()
    return audio.current
  }

  const pauseGame = useCallback(() => dispatch({ type: 'pause', now: Date.now() }), [])
  const resumeGame = useCallback(() => dispatch({ type: 'resume', now: Date.now() }), [])

  useGamePauseShortcut({ isPlaying: playing, onPause: pauseGame })
  usePageVisibilityPause({ isPlaying: playing, onPause: pauseGame })
  useEffect(() => {
    const pauseForPlatformSettings = () => pauseGame()
    window.addEventListener('orchard-arcade:settings-open', pauseForPlatformSettings)
    return () => window.removeEventListener('orchard-arcade:settings-open', pauseForPlatformSettings)
  }, [pauseGame])

  useEffect(() => {
    if (!playing || game.nextTickAt === null) return undefined
    const delay = Math.max(0, game.nextTickAt - Date.now())
    const timer = window.setTimeout(() => dispatch({ type: 'tick', now: Date.now() }), delay)
    return () => window.clearTimeout(timer)
  }, [game.nextTickAt, playing])

  useEffect(() => {
    if (playing) return
    audio.current?.suspend()
  }, [playing])

  useEffect(() => () => {
    if (effectTimer.current !== null) window.clearTimeout(effectTimer.current)
    if (invalidTimer.current !== null) window.clearTimeout(invalidTimer.current)
    audio.current?.dispose()
    audio.current = null
  }, [])

  useEffect(() => {
    if (!playing || validMoves.length > 0 || remainingTiles === 0) return
    const reshuffled = reshuffleRemainingTiles(game.board)
    if (reshuffled.stranded) {
      dispatch({ type: 'resolve-stranded', now: Date.now() })
      setFeedback(translate('剩餘訊號無法再形成連結，已自動收束並完成棋盤。'))
      return
    }
    dispatch({ type: 'reshuffle', board: reshuffled.board, now: Date.now() })
    setFeedback(translate('沒有可行連結，系統已免費重新編織剩餘色塊。'))
  }, [game.board, playing, remainingTiles, validMoves.length])

  useEffect(() => {
    if (game.status !== 'finished' || game.outcome === null || recorded.current) return
    recorded.current = true
    const previous = readAppStorage().games.colorLinks
    const personalBest = game.outcome === 'cleared'
      ? previous.bestTimeSeconds === undefined || game.elapsedSeconds < previous.bestTimeSeconds
      : game.removedTiles > previous.highScore
    setRoundResult(colorShareResult(game, personalBest))
    const next = recordColorLinksResult(
      game.outcome === 'cleared'
        ? { kind: 'cleared', completionSeconds: game.elapsedSeconds }
        : { kind: 'time-limit', removedTiles: game.removedTiles },
    )
    setBestTimeSeconds(next.games.colorLinks.bestTimeSeconds)
    onProgressChange()
    audio.current?.suspend()
  }, [game, onProgressChange])

  const clearTransientFeedback = () => {
    if (effectTimer.current !== null) window.clearTimeout(effectTimer.current)
    if (invalidTimer.current !== null) window.clearTimeout(invalidTimer.current)
    effectTimer.current = null
    invalidTimer.current = null
    setEffect(null)
    setInvalidCell(null)
  }

  const beginGame = () => {
    clearTransientFeedback()
    recorded.current = false
    setRoundResult(null)
    setFeedback(translate(`在 ${COLOR_LINKS_CONFIG.timeLimitSeconds} 秒內清空所有色塊。`))
    dispatch({ type: 'start', now: Date.now(), board: generateBoard() })
  }

  const startGame = () => {
    if (!tutorialSeen) {
      setTutorialOpen(true)
      return
    }
    beginGame()
  }

  const finishTutorial = () => {
    markGameTutorialSeen('colorLinks')
    setTutorialSeen(true)
    setTutorialOpen(false)
    beginGame()
  }

  const restartGame = () => {
    clearTransientFeedback()
    recorded.current = false
    setRoundResult(null)
    setFeedback(translate(`新的訊號盤已就緒，倒數 ${COLOR_LINKS_CONFIG.timeLimitSeconds} 秒。`))
    dispatch({ type: 'restart', now: Date.now(), board: generateBoard() })
    centerBoard()
  }

  const handleSelect = (position: CellPosition) => {
    if (!playing || game.board[position.row]?.[position.column] !== null) return
    const now = Date.now()
    const key = `${position.row}:${position.column}`
    if (
      lastInput.current?.key === key
      && now - lastInput.current.at < COLOR_LINKS_CONFIG.duplicateInputWindowMs
    ) return
    lastInput.current = { key, at: now }
    const matches = findMatchesAtCell(game.board, position)
    if (matches.length === 0) {
      getAudio().playInvalid(globalSettings.soundEnabled, 0.45)
      setEffect(null)
      setInvalidCell(position)
      setFeedback(translate(`沒有形成連結，扣 ${COLOR_LINKS_CONFIG.invalidPenaltySeconds} 秒。`))
      if (invalidTimer.current !== null) window.clearTimeout(invalidTimer.current)
      invalidTimer.current = window.setTimeout(() => {
        invalidTimer.current = null
        setInvalidCell(null)
      }, 280)
      dispatch({ type: 'select', position, now })
      return
    }
    const points = calculateColorLinkScore(matches)
    effectId.current += 1
    if (!effectsOff) {
      setEffect({ id: effectId.current, origin: position, matches, points })
      if (effectTimer.current !== null) window.clearTimeout(effectTimer.current)
      effectTimer.current = window.setTimeout(() => {
        effectTimer.current = null
        setEffect(null)
      }, reducedMotion ? 180 : COLOR_LINKS_CONFIG.effectDurationMs)
    }
    setInvalidCell(null)
    getAudio().playMatch(
      globalSettings.soundEnabled,
      0.45,
      totalDirections(matches),
      matches.length,
    )
    const bonus = matches.length > 1 ? translate(`，含 ${matches.length} 組獨立色彩 +${matches.length - 1} 加成`) : ''
    setFeedback(translate(`連結成功，移除 ${totalDirections(matches)} 格${bonus}。`))
    dispatch({ type: 'select', position, now })
  }

  if (game.status === 'ready') {
    return (
      <>
        <section className={`color-game-card color-start${effectsOff ? ' effects-off' : reducedMotion ? ' effects-reduced' : ''}`}>
        <div className="color-start-copy">
          <p className="eyebrow">CLEAR THE SIGNAL GRID</p>
          <h1>{translate("讓相同色彩，")}<br />{translate("在空白中")}<em>{translate("全數相遇")}</em>{translate("。")}</h1>
          <p>{translate("每局固定 ")}{COLOR_LINKS_CONFIG.initialTileCount}{translate(" 個色塊。點擊空格，連結四個方向最近的同色訊號；無路可走時自動重排，最後無法配對的零星色塊會自動收尾。在 30 秒內清空棋盤，才會記錄完成秒數。")}</p>
          <ul className="color-rule-chips" aria-label={translate("玩法摘要")}>
            <li>{translate("只點空格")}</li>
            <li>{translate("同色 ≥ 2")}</li>
            <li>{translate("30 秒倒數")}</li>
            <li>{translate("逾時記消除數")}</li>
            <li>{translate("失誤 −2 秒")}</li>
          </ul>
          <button type="button" className="primary-button color-primary" onClick={startGame}>{translate(" 開始串聯 ")}<span aria-hidden="true">→</span>
          </button>
          <p className="color-credit">{translate(" 玩法概念受到 ")}<a href="https://en.gamesaien.com/game/color_tiles/" target="_blank" rel="noopener noreferrer">Color Tiles</a>{translate(" 啟發； 名稱、規則細節、介面、色彩標記、音效與程式皆為原創實作。 ")}</p>
        </div>
        <div className="color-start-board">
          <div className="color-board-spec" aria-label={translate("Color Links 棋盤尺寸")}>
            <strong>17 × 10</strong>
            <span>{translate("訊號棋盤")}</span>
          </div>
          <ColorLinksBoard board={game.board} disabled reducedMotion={reducedMotion} />
          <span className="color-preview-caption">{translate("每種顏色都有獨立符號，不只依賴色相辨識。")}</span>
        </div>
        <div className="color-start-leaderboards" role="group" aria-label={translate("Color Links 線上排行榜")}>
          <LeaderboardPanel board="color-time" />
          <LeaderboardPanel board="color-removed" />
        </div>

        </section>
        {tutorialOpen ? <ColorLinksTutorialDialog onComplete={finishTutorial} onSkip={finishTutorial} /> : null}
      </>
    )
  }

  return (
    <section ref={containerRef} className={`color-game-card color-play${effectsOff ? ' effects-off' : reducedMotion ? ' effects-reduced' : ''}`}>
      <header className="color-game-topbar">
        <div>
          <p className="eyebrow">COLOR SIGNAL</p>
          <h1 className="game-play-title">Color Links</h1>
        </div>
        <button type="button" className="text-button compact" disabled={paused} onClick={restartGame}>{translate(" 重新開始 ")}</button>
      </header>
      <section className="color-hud" aria-label={translate("遊戲資訊")}>
        <div><span>{translate("剩餘")}</span><strong>{remainingTiles}</strong></div>
        <div><span>{translate("消除")}</span><strong>{game.removedTiles}</strong></div>
        <div><span>{translate("最快清空")}</span><strong>{formatElapsedTime(bestTimeSeconds)}</strong></div>
        <div className="timer"><span>{translate("倒數")}</span><Timer seconds={timeRemaining} label={translate("剩餘時間")} phase={getCountdownPhase(timeRemaining, playing)} /></div>
        <button type="button" className="icon-button color-pause-button" aria-label={translate("暫停遊戲")} disabled={!playing} onClick={pauseGame}>Ⅱ</button>
      </section>
      {paused ? (
        <div className="color-paused-board" aria-hidden="true">
          <span>◆</span>
          <strong>{translate("訊號已暫停")}</strong>
        </div>
      ) : (
        <ColorLinksBoard
          board={game.board}
          disabled={!playing}
          invalidCell={invalidCell}
          countdownSeconds={timeRemaining}
          effect={playing ? effect : null}
          reducedMotion={reducedMotion}
          onSelect={handleSelect}
        />
      )}
      <div className="color-board-meta">
        <p className="color-feedback" role="status" aria-live="polite">{translate(feedback)}</p>
        <span>{validMoves.length}{translate(" 個可行空格")}</span>
      </div>
      <p className="shortcut-tip">{translate("空格可用 Tab 聚焦，按 Enter 或空白鍵連結；Esc 暫停。")}</p>

      {paused && !platformSettingsOpen ? (
        <OverlayDialog label={translate("Color Links 已暫停")} onClose={resumeGame}>
          <p className="eyebrow">PAUSED</p>
          <h2>{translate("訊號暫停中")}</h2>
          <p>{translate("計時器與音效已停止。準備好後繼續。")}</p>
          <div className="dialog-actions">
            <button type="button" className="primary-button color-primary" onClick={resumeGame}>{translate("繼續遊戲")}</button>
            <button type="button" className="text-button" onClick={restartGame}>{translate("重新開始")}</button>
          </div>
        </OverlayDialog>
      ) : null}

      {game.status === 'finished' && roundResult ? (
        <ArcadeResultDialog result={roundResult} onReplay={restartGame} label={translate('Color Links 遊戲結果')}>
          <LeaderboardPanel board={game.outcome === 'cleared' ? 'color-time' : 'color-removed'} score={game.outcome === 'cleared' ? game.elapsedSeconds : game.removedTiles} />
        </ArcadeResultDialog>
      ) : null}

    </section>
  )
}
