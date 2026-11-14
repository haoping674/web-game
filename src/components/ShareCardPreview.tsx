import { translate } from '../app/translate'
type ShareCardPreviewProps = { imageUrl: string | null; isLoading: boolean; alt?: string }

export function ShareCardPreview({ imageUrl, isLoading, alt }: ShareCardPreviewProps) {
  if (isLoading) return <div className="share-card-preview is-loading" aria-live="polite">{translate("正在繪製成績卡⋯")}</div>
  if (!imageUrl) return <div className="share-card-preview is-unavailable">{translate("成績卡預覽暫時無法顯示")}</div>
  return <img className="share-card-preview" src={imageUrl} alt={alt ?? translate("Orchard Ten 本次成績分享卡預覽")} />
}
