import { GAME_VERSION } from '../game/constants'
import { OverlayDialog } from './OverlayDialog'

type AboutDialogProps = { onClose: () => void }
export function AboutDialog({ onClose }: AboutDialogProps) {
  return <OverlayDialog label="關於 Orchard Ten" onClose={onClose}><p className="eyebrow">ABOUT · v{GAME_VERSION}</p><h2>關於遊戲</h2><p>這是一款在限定時間內，透過矩形框選數字並湊成 10 的休閒益智遊戲。</p><p>核心玩法靈感來自 <a href="https://en.gamesaien.com/game/fruit_box/" target="_blank" rel="noopener noreferrer">Fruit Box</a>，並以原創的程式架構、介面與互動方式重新實作。</p><p>本網站為獨立製作的非官方作品，與參考網站及其開發者沒有隸屬、合作或授權關係。</p><button type="button" className="primary-button" onClick={onClose}>知道了</button></OverlayDialog>
}
