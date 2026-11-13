import { translate } from '../app/translate'
import { OverlayDialog } from './OverlayDialog'
type PauseDialogProps = { onResume: () => void; onRestart: () => void; onHome: () => void }
export function PauseDialog({ onResume, onRestart, onHome }: PauseDialogProps) {
  return <OverlayDialog label={translate("遊戲已暫停")} onEscape={onResume}><p className="eyebrow">PAUSED · BOARD HIDDEN</p><h2>{translate("果園暫停中")}</h2><p>{translate("棋盤已隱藏；倒數與 Combo 也已凍結。準備好後再繼續。")}</p><div className="dialog-actions"><button type="button" className="primary-button" onClick={onResume}>{translate("繼續遊戲")}</button><button type="button" className="text-button" onClick={onRestart}>{translate("重新開始")}</button><button type="button" className="text-button" onClick={onHome}>{translate("回到首頁")}</button></div></OverlayDialog>
}
