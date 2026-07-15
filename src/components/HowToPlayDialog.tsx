import { OverlayDialog } from './OverlayDialog'

type HowToPlayDialogProps = { onClose: () => void }
export function HowToPlayDialog({ onClose }: HowToPlayDialogProps) {
  return <OverlayDialog label="玩法說明" onClose={onClose}><p className="eyebrow">HOW TO PLAY</p><h2>框選，湊成 10</h2><ol className="rules-list"><li>按住滑鼠或手指，拖出一個矩形。</li><li>框內的數字總和剛好等於 10，就能消除並得分。</li><li>連續成功會累積 Combo；無效選取會中斷它。</li><li>卡住時使用有限的提示，或重新排列剩餘水果。</li></ol><button type="button" className="primary-button" onClick={onClose}>開始挑戰</button></OverlayDialog>
}
