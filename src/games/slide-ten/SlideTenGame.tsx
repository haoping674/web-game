import { useCallback, useEffect, useReducer, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { OverlayDialog } from '../../components/OverlayDialog'
import { PwaUpdateNotice } from '../../components/PwaUpdateNotice'
import { BOARD_COLUMNS, BOARD_ROWS, BOARD_SIZE } from '../../game/constants'
import { playComboSound, stopComboAudio } from '../../game/soundManager'
import { usePageVisibilityPause } from '../../hooks/usePageVisibilityPause'
import { readAppStorage, recordGameResult, type GlobalSettings } from '../../shared/storage/appStorage'
import { HOME_ROUTE, navigate } from '../../app/router'
import { LeaderboardPanel } from '../../shared/leaderboard/LeaderboardPanel'
import { LeaderboardDialog } from '../../shared/leaderboard/LeaderboardDialog'
import { createSlideState, screenDirection, slideReducer, type Direction } from './model'
import './slide-ten.css'

type Props = { globalSettings: GlobalSettings; onProgressChange: () => void; platformSettingsOpen: boolean }
const DIRECTIONS = [
  { direction: 'up', symbol: '↑', label: '向上滑動' },
  { direction: 'left', symbol: '←', label: '向左滑動' },
  { direction: 'down', symbol: '↓', label: '向下滑動' },
  { direction: 'right', symbol: '→', label: '向右滑動' },
] as const
const KEY_DIRECTIONS: Record<string, Direction> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }

function usePortraitLayout() {
  const query = '(max-width: 560px) and (orientation: portrait)'
  const [portrait, setPortrait] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const media = window.matchMedia(query)
    const update = () => setPortrait(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return portrait
}

function formatTime(ms: number) {
  const seconds = Math.floor(ms / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export default function SlideTenGame({ globalSettings, onProgressChange, platformSettingsOpen }: Props) {
  const [game, dispatch] = useReducer(slideReducer, undefined, () => createSlideState())
  const [selected, setSelected] = useState<number | null>(null)
  const [highScore, setHighScore] = useState(() => readAppStorage().games.slideTen.highScore)
  const [helpOpen, setHelpOpen] = useState(false)
  const [leaderboardOpen, setLeaderboardOpen] = useState(false)
  const roundKey = useRef('')
  const gesture = useRef<{ id: number; index: number; x: number; y: number } | null>(null)
  const recorded = useRef(false)
  const lastSoundMove = useRef(0)
  const portrait = usePortraitLayout()
  const playing = game.status === 'playing' && !platformSettingsOpen && !helpOpen
  const reducedMotion = globalSettings.reducedMotion || globalSettings.effectIntensity !== 'full'
  const occupied = game.board.filter((value) => value !== null).length
  const arrivals = new Map(game.arrivals.map((arrival) => [arrival.index, arrival.value]))
  const warning = playing && game.untilWaveMs <= 1_000
  const lastMove = game.lastMove && game.elapsedMs - game.lastMove.atMs < 400 ? game.lastMove : null
  const selectedFruit = selected !== null ? game.board[selected] : null
  const pause = useCallback(() => dispatch({ type: 'pause', now: Date.now() }), [])
  const resume = useCallback(() => dispatch({ type: 'resume', now: Date.now() }), [])

  usePageVisibilityPause({ isPlaying: playing, onPause: pause })
  useEffect(() => {
    window.addEventListener('orchard-arcade:settings-open', pause)
    return () => window.removeEventListener('orchard-arcade:settings-open', pause)
  }, [pause])
  useEffect(() => {
    if (!playing) { gesture.current = null; stopComboAudio(); return undefined }
    const timer = window.setInterval(() => dispatch({ type: 'tick', now: Date.now() }), 100)
    return () => window.clearInterval(timer)
  }, [playing])
  useEffect(() => {
    if (game.status !== 'ended' || recorded.current) return
    recorded.current = true
    const result = recordGameResult('slideTen', game.score)
    setHighScore(result.games.slideTen.highScore)
    onProgressChange()
  }, [game.status, game.score, onProgressChange])
  useEffect(() => {
    if (game.moveId === lastSoundMove.current) return
    lastSoundMove.current = game.moveId
    if (game.lastMove?.matched && playing) playComboSound({ enabled: globalSettings.soundEnabled, volume: .45, combo: 1, lowStimulus: reducedMotion })
  }, [game.moveId, game.lastMove, playing, globalSettings.soundEnabled, reducedMotion])
  useEffect(() => () => stopComboAudio(), [])

  const start = () => {
    roundKey.current = crypto.randomUUID()
    recorded.current = false
    lastSoundMove.current = 0
    gesture.current = null
    setSelected(null)
    setHelpOpen(false)
    dispatch({ type: 'start', seed: Math.floor(Math.random() * 0xffffffff), now: Date.now() })
  }
  const move = (from: number, direction: Direction) => {
    if (!playing) return
    dispatch({ type: 'slide', from, direction: screenDirection(direction, portrait), now: Date.now() })
    setSelected(null)
  }
  const pointerDown = (event: PointerEvent<HTMLButtonElement>, index: number) => {
    if (!playing || game.board[index] === null || !event.isPrimary || event.button !== 0) return
    gesture.current = { id: event.pointerId, index, x: event.clientX, y: event.clientY }
    setSelected(index)
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const pointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const active = gesture.current
    gesture.current = null
    if (!active || event.pointerId !== active.id) return
    const dx = event.clientX - active.x
    const dy = event.clientY - active.y
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 12) return
    move(active.index, Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'))
  }

  return (
    <div className="app-shell slide-ten-shell">
      <section className={`game-card slide-ten-card${reducedMotion ? ' slide-reduced-motion' : ''}`}>
        {game.status === 'ready' ? (
          <div className="slide-start">
            <div className="slide-start-copy">
              <p className="eyebrow">SLIDE TEN · 試玩版</p>
              <h1>滑一下，<br /><em>剛好湊十。</em></h1>
              <p>自己創造配對，把快滿的果園救回來。<br />熟悉的 170 格棋盤，這次由你搬動水果。</p>
              <ol><li>滑動一顆水果，沿直線移動。</li><li>同一直線依序湊十就消除，中間有空格也可以。</li><li>倒數歸零時，空格必須多於下一批水果數量。</li></ol>
              <button type="button" className="primary-button" onClick={start}>開始滑滑湊十 <span aria-hidden="true">↗</span></button>
              <p className="slide-best">本機最高分 <strong>{highScore}</strong></p>
              <button type="button" className="text-button" onClick={() => setLeaderboardOpen(true)}>查看線上排行榜 ↗</button>
            </div>
            <div className="slide-demo" aria-label="示意：將 4 向右滑，與 6 湊十消除">
              <span className="slide-demo-caption">先移動，再配對。</span>
              <div><span className="fruit-cell fruit-theme-3"><i className="fruit-leaf" /><b>4</b></span><span className="slide-demo-arrow">→</span><span className="fruit-cell fruit-theme-5"><i className="fruit-leaf" /><b>6</b></span></div>
              <strong>4 + 6 = 10</strong><p>配對消除，空間就回來了。</p>
              <small>17 × 10 格 · 手機直式 10 × 17 格</small>
            </div>
          </div>
        ) : (
          <div className="slide-play" onKeyDown={(event) => {
            if (event.key === 'Escape' && playing) { event.preventDefault(); pause(); return }
            const direction = KEY_DIRECTIONS[event.key]
            if (direction && selected !== null && playing) { event.preventDefault(); move(selected, direction) }
          }}>
            <div className="play-topbar"><div className="play-identity"><strong>滑滑湊十</strong><span className="mode-chip">SLIDE TEN</span></div><button type="button" className="text-button compact" onClick={() => { pause(); setHelpOpen(true) }}>玩法說明</button></div>
            <div className="hud slide-hud">
              <div><span>消除顆數</span><strong data-testid="slide-score">{game.score}</strong></div>
              <div className="slide-matches"><span>消除次數</span><strong>{game.pairs} 次</strong></div>
              <div className="timer"><span>下一批 · {game.waveCount} 顆</span><strong className={warning ? 'slide-urgent' : ''}>{(game.untilWaveMs / 1000).toFixed(1)}s</strong></div>
              <button type="button" className="icon-button" aria-label="暫停遊戲" disabled={!playing} onClick={pause}>Ⅱ</button>
            </div>
            <div className="slide-capacity"><span>果園空位 <strong>{BOARD_SIZE - occupied}</strong> / {BOARD_SIZE}</span><div role="meter" aria-label="棋盤佔用比例" aria-valuemin={0} aria-valuemax={BOARD_SIZE} aria-valuenow={occupied}><i className={occupied / BOARD_SIZE > .8 ? 'is-danger' : ''} style={{ width: `${occupied / BOARD_SIZE * 100}%` }} /></div><span>已玩 {formatTime(game.elapsedMs)}</span></div>
            {game.status === 'paused' ? <div className="slide-paused-board" role="status"><span>Ⅱ</span><strong>果園休息中</strong><p>補入倒數已暫停。</p></div> : (
              <div className={`board-frame slide-board-frame${portrait ? ' is-portrait' : ''}`}>
                <div className="slide-board" role="grid" aria-label="滑滑湊十水果棋盤" aria-rowcount={portrait ? BOARD_COLUMNS : BOARD_ROWS} aria-colcount={portrait ? BOARD_ROWS : BOARD_COLUMNS} style={{ '--slide-columns': portrait ? BOARD_ROWS : BOARD_COLUMNS, '--slide-rows': portrait ? BOARD_COLUMNS : BOARD_ROWS } as CSSProperties}>
                  {Array.from({ length: portrait ? BOARD_COLUMNS : BOARD_ROWS }, (_, visibleRow) => (
                    <div key={visibleRow} className="slide-board-row" role="row">
                      {Array.from({ length: portrait ? BOARD_ROWS : BOARD_COLUMNS }, (_, visibleCol) => {
                        const index = portrait ? visibleCol * BOARD_COLUMNS + visibleRow : visibleRow * BOARD_COLUMNS + visibleCol
                        const value = game.board[index]!
                        const incoming = warning && value === null ? arrivals.get(index) : undefined
                        const matched = lastMove?.matched && lastMove.cleared.includes(index)
                        return (
                          <div className="slide-gridcell" role="gridcell" key={index}>
                            <button type="button" className={`slide-cell${value === null ? ' is-empty' : ` fruit-cell fruit-theme-${(value - 1) % 9}`}${selected === index && value !== null ? ' is-selected' : ''}${incoming !== undefined ? ' is-arriving' : ''}${matched ? ' is-matched' : ''}${lastMove && !lastMove.matched && lastMove.to === index ? ' is-moved' : ''}`}
                              aria-label={`第 ${visibleRow + 1} 列第 ${visibleCol + 1} 格，${value === null ? '空格' : `水果 ${value}`}${incoming !== undefined ? `，即將長出 ${incoming}` : ''}`}
                              aria-pressed={value !== null && selected === index} disabled={!playing || value === null} data-index={index} data-value={value ?? ''}
                              onPointerDown={(event) => pointerDown(event, index)} onPointerUp={pointerUp} onPointerCancel={() => { gesture.current = null }}
                              onClick={(event) => { if (event.detail === 0 && value !== null) setSelected(index) }}>
                              {value !== null ? <><i className="fruit-leaf" /><span className="fruit-value">{value}</span></> : incoming !== undefined ? <span>{incoming}</span> : matched ? <span>✦</span> : null}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="slide-input-bar"><p className="slide-feedback" role="status">{selectedFruit ? `已選 ${selectedFruit}，沿直線依序湊 ${10 - selectedFruit}，可跨空格；滑動或按方向。` : lastMove?.matched ? `消除 ${lastMove.cleared.length} 顆 +${lastMove.points}！繼續尋找下一組。` : '滑動水果，或點選後按方向，撞出剛好 10。'}</p><div className="slide-direction-pad" role="group" aria-label="滑動方向">{DIRECTIONS.map(({ direction, symbol, label }) => <button type="button" key={direction} aria-label={label} disabled={!playing || !selectedFruit} onClick={() => selected !== null && move(selected, direction)}>{symbol}</button>)}</div></div>
            <p className="shortcut-tip">每消除一顆得 1 分 · 每 20 秒加快補入 · 選水果後方向鍵移動，Esc 暫停</p>
          </div>
        )}
        {game.status === 'paused' && !platformSettingsOpen && !helpOpen ? <OverlayDialog label="滑滑湊十已暫停" onClose={resume}><p className="eyebrow">TAKE A LITTLE BREAK</p><h2>果園已暫停</h2><p>補入倒數會等你回來。</p><button type="button" className="primary-button" onClick={resume}>繼續遊戲</button><button type="button" className="text-button" onClick={start}>重新開始</button></OverlayDialog> : null}
        {helpOpen ? <OverlayDialog label="滑滑湊十玩法說明" onClose={() => setHelpOpen(false)}><p className="eyebrow">SLIDE · MATCH · MAKE ROOM</p><h2>滑到一起，剛好湊十。</h2><p>滑動單顆水果，會沿直線滑到底。遇到水果時，沿滑動方向跳過空格，依序累加同一直線上的水果，總和剛好為 10 就整組消除。例如 5 → 2 → 空格 → 3，三顆一起消除。不能跳過有數字的水果；總和超過 10，或到邊界仍不足 10，就停在第一顆前面。每消除一顆得 1 分，分數就是消除水果的總顆數。</p><p>也可以點選水果，再按棋盤下方方向按鈕，或使用鍵盤方向鍵。單純搬動水果不加分。</p><p>每批補入前 1 秒，空格會顯示即將長出的數字。倒數歸零時，若空格小於或等於下一批水果數量，就結束遊戲；每 20 秒補入速度與數量提高。</p><button type="button" className="primary-button" onClick={() => setHelpOpen(false)}>了解了</button></OverlayDialog> : null}
        {game.status === 'ended' ? <OverlayDialog label="滑滑湊十遊戲結束"><p className="eyebrow">MAKE ROOM FOR THE NEXT WAVE</p><h2>空位不夠，再滑一局？</h2><p>你清出了 {game.removedFruits} 格空間，守住果園 {formatTime(game.elapsedMs)}。</p><div className="slide-result"><span>本局得分<strong>{game.score}</strong></span><span>消除次數<strong>{game.pairs}</strong></span><span>本機最高<strong>{highScore}</strong></span></div><LeaderboardPanel key={roundKey.current} board="slide-cleared" score={game.score} resultKey={`slide-ten-count:${roundKey.current}`} /><button type="button" className="primary-button" onClick={start}>再玩一次</button><button type="button" className="text-button" onClick={() => navigate(HOME_ROUTE)}>返回遊戲廳</button></OverlayDialog> : null}
      </section>
      {leaderboardOpen ? <LeaderboardDialog initialBoard="slide-cleared" onClose={() => setLeaderboardOpen(false)} /> : null}
      <PwaUpdateNotice isGameActive={game.status === 'playing' || game.status === 'paused'} />
    </div>
  )
}
