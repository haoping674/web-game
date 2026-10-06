import { createPortal } from 'react-dom'

type PwaUpdateDialogProps = { visible: boolean; isGameActive: boolean; onUpdate: () => Promise<void>; onLater: () => void }

export function PwaUpdateDialog({ visible, isGameActive, onUpdate, onLater }: PwaUpdateDialogProps) {
  if (!visible || isGameActive) return null
  return createPortal(<section className="pwa-update" role="status" aria-live="polite"><div><strong>有新版本可更新</strong><span>已儲存的遊戲紀錄與進度會保留。</span></div><div className="pwa-update-actions"><button type="button" className="quiet-button" onClick={onLater}>稍後</button><button type="button" className="primary-button" onClick={() => void onUpdate()}>立即更新</button></div></section>, document.body)
}
