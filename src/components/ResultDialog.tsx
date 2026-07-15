import { OverlayDialog } from './OverlayDialog'
type ResultDialogProps = { score: number; highScore: number; remaining: number; onRestart: () => void; onHome: () => void }
export function ResultDialog({ score, highScore, remaining, onRestart, onHome }: ResultDialogProps) {
  return <OverlayDialog label="本局結算"><p className="eyebrow">時間到</p><h2>今日收成</h2><strong className="result-score">{score}</strong><p>最高收成：{highScore}</p><p>果園還有 {remaining} 顆等待下一輪。</p><div className="dialog-actions"><button type="button" className="primary-button" autoFocus onClick={onRestart}>再玩一次 <span aria-hidden="true">↻</span></button><button type="button" className="text-button" onClick={onHome}>回到首頁</button></div></OverlayDialog>
}
