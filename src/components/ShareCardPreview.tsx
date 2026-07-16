type ShareCardPreviewProps = { imageUrl: string | null; isLoading: boolean }

export function ShareCardPreview({ imageUrl, isLoading }: ShareCardPreviewProps) {
  if (isLoading) return <div className="share-card-preview is-loading" aria-live="polite">正在繪製成績卡⋯</div>
  if (!imageUrl) return <div className="share-card-preview is-unavailable">成績卡預覽暫時無法顯示</div>
  return <img className="share-card-preview" src={imageUrl} alt="Orchard Ten 本次成績分享卡預覽" />
}
