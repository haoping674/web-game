import { OverlayDialog } from './OverlayDialog'

export function IosInstallDialog({ onClose }: { onClose: () => void }) {
  return <OverlayDialog label="安裝 Orchard Ten" onClose={onClose}><p className="eyebrow">INSTALL ON IPHONE</p><h2>加入主畫面</h2><p>Safari 不提供直接安裝按鈕。請點選瀏覽器底部的「分享」按鈕，向下滑動後選擇「加入主畫面」，再按「加入」。</p><button type="button" className="primary-button" onClick={onClose}>知道了</button></OverlayDialog>
}
