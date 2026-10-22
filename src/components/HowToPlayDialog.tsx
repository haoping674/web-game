import { AUTO_HINT_DELAY_MS } from '../game/constants'
import { OverlayDialog } from './OverlayDialog'

type HowToPlayDialogProps = { onClose: () => void }
export function HowToPlayDialog({ onClose }: HowToPlayDialogProps) {
  return <OverlayDialog label="玩法說明" onClose={onClose}><p className="eyebrow">HOW TO PLAY</p><h2>框選，湊成 10</h2><ol className="rules-list"><li>按住滑鼠或手指，拖出一個矩形。</li><li>框內的數字總和剛好等於 10，就能消除並得分。</li><li>連續成功會累積 Combo；無效選取會中斷它。</li><li>連續 {AUTO_HINT_DELAY_MS / 1_000} 秒未成功消除，會自動標示可行組合；沒有可行組合時會自動重排。</li></ol><button type="button" className="primary-button" onClick={onClose}>開始挑戰</button></OverlayDialog>
}
