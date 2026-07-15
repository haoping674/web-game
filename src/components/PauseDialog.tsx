import { OverlayDialog } from './OverlayDialog'
type PauseDialogProps = { onResume: () => void; onRestart: () => void; onHome: () => void }
export function PauseDialog({ onResume, onRestart, onHome }: PauseDialogProps) {
  return <OverlayDialog label="遊戲已暫停"><p className="eyebrow">果園靜止中</p><h2>先歇一下。</h2><p>倒數已暫停，收成進度會好好保留。</p><div className="dialog-actions"><button type="button" className="primary-button" autoFocus onClick={onResume}>繼續遊戲</button><button type="button" className="text-button" onClick={onRestart}>重新開始</button><button type="button" className="text-button" onClick={onHome}>回到首頁</button></div></OverlayDialog>
}
