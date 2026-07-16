import { useMemo, useRef, useState } from 'react'
import { ROUND_SECONDS } from '../game/constants'
import { clearsPerMinute, getPerformanceLabel } from '../game/scoring'
import type { GameState, GameStatistics } from '../game/types'
import type { ShareResult } from '../share/types'
import { OverlayDialog } from './OverlayDialog'
import { ShareResultDialog } from './ShareResultDialog'
type ResultDialogProps = { game: GameState; statistics: GameStatistics; onRestart: () => void; onHome: () => void }
export function ResultDialog({ game, statistics, onRestart, onHome }: ResultDialogProps) {
  const cleared = game.score
  const record = game.score >= statistics.highScore && game.score > 0
  const [shareOpen, setShareOpen] = useState(false)
  const shareButtonRef = useRef<HTMLButtonElement>(null)
  const shareResult = useMemo<ShareResult>(() => ({ mode: 'classic', score: game.score, maxCombo: game.bestCombo, clearedFruitCount: cleared, successfulMoves: game.successfulMoves, playedAt: new Date(), pageUrl: window.location.href }), [cleared, game.bestCombo, game.score, game.successfulMoves])
  const closeShare = () => { setShareOpen(false); window.setTimeout(() => shareButtonRef.current?.focus(), 0) }
  return <><OverlayDialog label="本局結算"><p className="eyebrow">{record ? 'NEW PERSONAL BEST' : getPerformanceLabel(game.score)}</p><h2>本局完成！</h2><strong className="result-score">{game.score}</strong><p>最高分 {statistics.highScore}{record ? ' · 刷新紀錄！' : ''}</p><dl className="result-stats"><div><dt>消除水果</dt><dd>{cleared}</dd></div><div><dt>最高 Combo</dt><dd>{game.bestCombo}</dd></div><div><dt>成功操作</dt><dd>{game.successfulMoves}</dd></div><div><dt>無效操作</dt><dd>{game.invalidMoves}</dd></div><div><dt>每分鐘消除</dt><dd>{clearsPerMinute(cleared, ROUND_SECONDS - game.secondsLeft)}</dd></div></dl><div className="dialog-actions"><button type="button" className="primary-button" onClick={onRestart}>再玩一次 <span aria-hidden="true">→</span></button><button ref={shareButtonRef} type="button" className="quiet-button share-button" onClick={() => setShareOpen(true)}>分享成績 <span aria-hidden="true">↗</span></button><button type="button" className="text-button" onClick={onHome}>回到首頁</button></div></OverlayDialog>{shareOpen && <ShareResultDialog result={shareResult} onClose={closeShare} />}</>
}
