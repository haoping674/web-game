import { translate, isEnglish } from '../app/translate'
import { useEffect } from 'react'
import type { ShareResult } from '../share/types'
import { useShareResult, type ResultShareActions } from '../share/useShareResult'
import { OverlayDialog } from './OverlayDialog'
import { ShareCardPreview } from './ShareCardPreview'

type ShareResultDialogProps = { result: ShareResult; onClose: () => void }

export function ShareResultDialog({ result, onClose }: ShareResultDialogProps) {
  const share = useShareResult(result)
  return <ShareResultContent result={result} share={share} onClose={onClose} />
}

export function ShareResultContent({ result, onClose, share }: ShareResultDialogProps & { share: ResultShareActions }) {
  const { copy, download, hasSystemShare, hasImageShare, isGenerating, preparePreview, previewUrl, status, systemShare } = share
  useEffect(() => { void preparePreview() }, [preparePreview])
  return <OverlayDialog label={translate("分享本次成績")} onClose={onClose}>
    <p className="eyebrow">SHARE YOUR HARVEST</p>
    <h2>{translate("分享成績")}</h2>
    <p>{translate("分享內容只包含本局成果，不會包含棋盤或解法。")}</p>
    <ShareCardPreview imageUrl={previewUrl} isLoading={isGenerating} alt={'kind' in result ? `${result.gameName} ${isEnglish() ? 'result card' : '成果圖卡'}` : undefined} />
    {!hasSystemShare && <p className="share-fallback" role="status">{translate("此瀏覽器未支援系統分享，可改用複製或下載。")}</p>}
    <div className="share-actions">
      <button type="button" className="primary-button" disabled={!hasSystemShare || isGenerating} onClick={() => void systemShare()}>{hasImageShare ? (isEnglish() ? 'Share image' : '分享圖卡') : (isEnglish() ? 'Share link' : '分享連結')}</button>
      <button type="button" className="quiet-button share-action-button" onClick={() => void copy()}>{translate("複製成績")}</button>
      <button type="button" className="quiet-button share-action-button" disabled={isGenerating} onClick={() => void download()}>{translate("下載成績卡")}</button>
      <button type="button" className="text-button" onClick={onClose}>{isEnglish() ? 'Close' : '關閉'}</button>
    </div>
    <p className={`share-status${status?.tone ? ` is-${status.tone}` : ''}`} aria-live="polite">{translate(status?.message)}</p>
  </OverlayDialog>
}
