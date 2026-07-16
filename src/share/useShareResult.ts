import { useCallback, useEffect, useRef, useState } from 'react'
import { renderShareCard } from './shareCardRenderer'
import { createShareText } from './shareText'
import { copyShareText, createShareFilename, downloadShareCard, shareResult } from './shareService'
import type { ShareResult } from './types'

type ShareStatus = { message: string; tone: 'success' | 'error' | 'neutral' }

export function useShareResult(result: ShareResult) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [status, setStatus] = useState<ShareStatus | null>(null)
  const cardRef = useRef<Blob | null>(null)
  const previewRef = useRef<string | null>(null)
  const hasSystemShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  useEffect(() => () => { if (previewRef.current) URL.revokeObjectURL(previewRef.current) }, [])

  const ensureCard = useCallback(async (): Promise<Blob> => {
    if (cardRef.current) return cardRef.current
    setIsGenerating(true)
    try {
      const card = await renderShareCard(result)
      cardRef.current = card
      const nextPreview = URL.createObjectURL(card)
      if (previewRef.current) URL.revokeObjectURL(previewRef.current)
      previewRef.current = nextPreview
      setPreviewUrl(nextPreview)
      return card
    } finally { setIsGenerating(false) }
  }, [result])

  const preparePreview = useCallback(async () => {
    try { await ensureCard() } catch { setStatus({ message: '成績卡暫時無法產生，仍可複製文字成績。', tone: 'error' }) }
  }, [ensureCard])

  const copy = useCallback(async () => {
    const copied = await copyShareText(createShareText(result))
    setStatus(copied ? { message: '成績已複製。', tone: 'success' } : { message: '無法自動複製，請稍後再試。', tone: 'error' })
  }, [result])

  const download = useCallback(async () => {
    try {
      const card = await ensureCard()
      const downloaded = downloadShareCard(card, createShareFilename(result))
      setStatus(downloaded ? { message: '成績卡已開始下載。', tone: 'success' } : { message: '下載未成功，請改用系統分享或稍後重試。', tone: 'error' })
    } catch { setStatus({ message: '無法產生成績卡，請改用複製成績。', tone: 'error' }) }
  }, [ensureCard, result])

  const systemShare = useCallback(async () => {
    if (!hasSystemShare) { setStatus({ message: '此瀏覽器未支援系統分享，請複製成績或下載成績卡。', tone: 'neutral' }); return }
    let image: File | undefined
    try {
      const card = await ensureCard()
      image = new File([card], createShareFilename(result), { type: 'image/png' })
    } catch { /* text sharing remains available when the card cannot be drawn */ }
    const outcome = await shareResult(result, image)
    if (outcome === 'shared') setStatus({ message: '已開啟系統分享。', tone: 'success' })
    if (outcome === 'failed') setStatus({ message: '系統分享沒有完成，請改用複製成績或下載成績卡。', tone: 'error' })
  }, [ensureCard, hasSystemShare, result])

  return { copy, download, hasSystemShare, isGenerating, preparePreview, previewUrl, status, systemShare }
}
