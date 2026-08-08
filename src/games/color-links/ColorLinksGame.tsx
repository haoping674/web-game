import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { OverlayDialog } from '../../components/OverlayDialog'
import { PwaUpdateNotice } from '../../components/PwaUpdateNotice'
import { Timer } from '../../components/Timer'
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
  const [feedback, setFeedback] = useState('點擊空格，連結兩個以上同色訊號。')
  const [effect, setEffect] = useState<ColorLinksEffect | null>(null)
  const [invalidCell, setInvalidCell] = useState<CellPosition | null>(null)
  const [bestTimeSeconds, setBestTimeSeconds] = useState(() => readAppStorage().games.colorLinks.bestTimeSeconds)
  const [shareStatus, setShareStatus] = useState('')
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
  const effectsOff = globalSettings.effectIntensity === 'off'
  const validMoves = useMemo(() => findAllValidMoves(game.board), [game.board])
  const remainingTiles = useMemo(
    () => game.board.reduce((total, row) => total + row.filter((cell) => cell !== null).length, 0),
    [game.board],
  )
  const playing = game.status === 'playing'
  const paused = game.status === 'paused'

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
    if (reshuffled.regenerated) {
      dispatch({ type: 'resolve-stranded' })
      setFeedback('剩餘訊號無法再形成連結，已自動收束並完成棋盤。')
      return
    }
    dispatch({ type: 'reshuffle', board: reshuffled.board })
    setFeedback('沒有可行連結，系統已免費重新編織剩餘色塊。')
  }, [game.board, playing, remainingTiles, validMoves.length])

  useEffect(() => {
    if (game.status !== 'finished' || recorded.current) return
    recorded.current = true
    const next = recordColorLinksResult(game.elapsedSeconds)
    setBestTimeSeconds(next.games.colorLinks.bestTimeSeconds)
    onProgressChange()
    audio.current?.suspend()
  }, [game.elapsedSeconds, game.status, onProgressChange])

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
    setShareStatus('')
    setFeedback('點擊空格，連結兩個以上同色訊號。')
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
    setShareStatus('')
    setFeedback('新的訊號盤已就緒。')
    dispatch({ type: 'restart', now: Date.now(), board: generateBoard() })
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
      setFeedback(`沒有形成連結，加 ${COLOR_LINKS_CONFIG.invalidPenaltySeconds} 秒。`)
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
    const bonus = matches.length > 1 ? `，含 ${matches.length} 組獨立色彩 +${matches.length - 1} 加成` : ''
    setFeedback(`連結成功，移除 ${totalDirections(matches)} 格${bonus}。`)
    dispatch({ type: 'select', position, now })
  }

  const shareResult = async () => {
    const text = `我在 Color Links 用時 ${formatElapsedTime(game.elapsedSeconds)} 清空了 ${game.removedTiles} 個色塊。`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Color Links 成績', text, url: window.location.href })
        setShareStatus('成績已分享。')
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(`${text} ${window.location.href}`)
        setShareStatus('成績文字已複製。')
      } else {
        setShareStatus(text)
      }
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setShareStatus('目前無法分享，請稍後再試。')
    }
  }

  if (game.status === 'ready') {
    return (
      <>
        <section className={`color-game-card color-start${effectsOff ? ' effects-off' : reducedMotion ? ' effects-reduced' : ''}`}>
        <div className="color-start-copy">
          <p className="eyebrow">CLEAR THE SIGNAL GRID</p>
          <h1>讓相同色彩，<br />在空白中<em>全數相遇</em>。</h1>
          <p>點擊空格，向四個方向尋找最近色塊。兩個以上同色訊號就能完成連結。</p>
          <ul className="color-rule-chips" aria-label="玩法摘要">
            <li>只點空格</li>
            <li>同色 ≥ 2</li>
            <li>清空即結算</li>
            <li>失誤 +2 秒</li>
          </ul>
          <button type="button" className="primary-button color-primary" onClick={startGame}>
            開始串聯 <span aria-hidden="true">→</span>
          </button>
          <p className="color-credit">
            玩法概念受到 <a href="https://en.gamesaien.com/game/color_tiles/" target="_blank" rel="noopener noreferrer">Color Tiles</a> 啟發；
            名稱、規則細節、介面、色彩標記、音效與程式皆為原創實作。
          </p>
        </div>
        <div className="color-start-board">
          <div className="color-board-spec" aria-label="Color Links 棋盤尺寸">
            <strong>17 × 10</strong>
            <span>訊號棋盤</span>
          </div>
          <ColorLinksBoard board={game.board} disabled reducedMotion={reducedMotion} />
          <span className="color-preview-caption">每種顏色都有獨立符號，不只依賴色相辨識。</span>
        </div>
        <PwaUpdateNotice isGameActive={false} />
        </section>
        {tutorialOpen ? <ColorLinksTutorialDialog onComplete={finishTutorial} onSkip={finishTutorial} /> : null}
      </>
    )
  }

  return (
    <section className={`color-game-card color-play${effectsOff ? ' effects-off' : reducedMotion ? ' effects-reduced' : ''}`}>
      <header className="color-game-topbar">
        <div>
          <p className="eyebrow">COLOR SIGNAL</p>
          <strong>Color Links</strong>
        </div>
        <button type="button" className="text-button compact" disabled={paused} onClick={restartGame}>
          重新開始
        </button>
      </header>
      <section className="color-hud" aria-label="遊戲資訊">
        <div><span>色塊</span><strong>{remainingTiles}</strong></div>
        <div><span>連結</span><strong>{game.successfulMoves}</strong></div>
        <div><span>最快</span><strong>{formatElapsedTime(bestTimeSeconds)}</strong></div>
        <div className="timer"><span>用時</span><Timer seconds={game.elapsedSeconds} label="用時" /></div>
        <button type="button" className="icon-button color-pause-button" aria-label="暫停遊戲" disabled={!playing} onClick={pauseGame}>Ⅱ</button>
      </section>
      {paused ? (
        <div className="color-paused-board" aria-hidden="true">
          <span>◆</span>
          <strong>訊號已暫停</strong>
        </div>
      ) : (
        <ColorLinksBoard
          board={game.board}
          disabled={!playing}
          invalidCell={invalidCell}
          effect={effect}
          reducedMotion={reducedMotion}
          onSelect={handleSelect}
        />
      )}
      <div className="color-board-meta">
        <p className="color-feedback" role="status" aria-live="polite">{feedback}</p>
        <span>{validMoves.length} 個可行空格</span>
      </div>
      <p className="shortcut-tip">空格可用 Tab 聚焦，按 Enter 或空白鍵連結；Esc 暫停。</p>

      {paused && !platformSettingsOpen ? (
        <OverlayDialog label="Color Links 已暫停" onClose={resumeGame}>
          <p className="eyebrow">PAUSED</p>
          <h2>訊號暫停中</h2>
          <p>計時器與音效已停止。準備好後繼續。</p>
          <div className="dialog-actions">
            <button type="button" className="primary-button color-primary" onClick={resumeGame}>繼續遊戲</button>
            <button type="button" className="text-button" onClick={restartGame}>重新開始</button>
          </div>
        </OverlayDialog>
      ) : null}

      {game.status === 'finished' ? (
        <OverlayDialog label="Color Links 遊戲結果" onClose={restartGame}>
          <p className="eyebrow">SIGNAL COMPLETE</p>
          <h2>全數色塊已清空</h2>
          <strong className="result-score color-result-score">{formatElapsedTime(game.elapsedSeconds)}</strong>
          <dl className="result-stats">
            <div><dt>完成用時</dt><dd>{formatElapsedTime(game.elapsedSeconds)}</dd></div>
            <div><dt>移除色塊</dt><dd>{game.removedTiles}</dd></div>
            <div><dt>有效連結</dt><dd>{game.successfulMoves}</dd></div>
            <div><dt>無效點擊</dt><dd>{game.invalidMoves}</dd></div>
            <div><dt>自動重排</dt><dd>{game.reshuffles}</dd></div>
          </dl>
          <div className="dialog-actions">
            <button type="button" className="primary-button color-primary" onClick={restartGame}>再玩一次</button>
            <button type="button" className="quiet-button share-button" onClick={() => void shareResult()}>分享成績 ↗</button>
          </div>
          {shareStatus ? <p className="share-status" role="status">{shareStatus}</p> : null}
        </OverlayDialog>
      ) : null}
      <PwaUpdateNotice isGameActive={playing || paused} />
    </section>
  )
}
