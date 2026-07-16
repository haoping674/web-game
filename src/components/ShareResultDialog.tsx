import { useEffect } from 'react'
import type { ShareResult } from '../share/types'
import { useShareResult } from '../share/useShareResult'
import { OverlayDialog } from './OverlayDialog'
import { ShareCardPreview } from './ShareCardPreview'

type ShareResultDialogProps = { result: ShareResult; onClose: () => void }

export function ShareResultDialog({ result, onClose }: ShareResultDialogProps) {
  const { copy, download, hasSystemShare, isGenerating, preparePreview, previewUrl, status, systemShare } = useShareResult(result)
  useEffect(() => { void preparePreview() }, [preparePreview])
  return <OverlayDialog label="分享本次成績" onClose={onClose}>
    <p className="eyebrow">SHARE YOUR HARVEST</p>
    <h2>分享成績</h2>
    <p>分享內容只包含本局成果，不會包含棋盤或解法。</p>
    <ShareCardPreview imageUrl={previewUrl} isLoading={isGenerating} />
    {!hasSystemShare && <p className="share-fallback" role="status">此瀏覽器未支援系統分享，可改用複製或下載。</p>}
    <div className="share-actions">
      <button type="button" className="primary-button" onClick={() => void systemShare()}>分享到系統</button>
      <button type="button" className="quiet-button share-action-button" onClick={() => void copy()}>複製成績</button>
      <button type="button" className="quiet-button share-action-button" disabled={isGenerating} onClick={() => void download()}>下載成績卡</button>
      <button type="button" className="text-button" onClick={onClose}>關閉</button>
    </div>
    <p className={`share-status${status?.tone ? ` is-${status.tone}` : ''}`} aria-live="polite">{status?.message}</p>
  </OverlayDialog>
}
