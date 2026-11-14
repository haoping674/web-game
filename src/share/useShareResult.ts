import { useCallback, useEffect, useMemo, useState } from 'react'
import { renderShareCard } from './shareCardRenderer'
import { createShareText } from './shareText'
import { copyShareText, createShareFilename, downloadShareCard, shareResult } from './shareService'
import type { ShareResult } from './types'

type ShareStatus = { message: string; tone: 'success' | 'error' | 'neutral' }

export function useShareResult(result: ShareResult) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [status, setStatus] = useState<ShareStatus | null>(null)
  const cache = useMemo(() => ({ result, active: true, blob: null as Blob | null, pending: null as Promise<Blob> | null, url: null as string | null }), [result])
  const hasSystemShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  useEffect(() => {
    cache.active = true
    setPreviewUrl(null)
    setStatus(null)
    return () => {
      cache.active = false
      if (cache.url) URL.revokeObjectURL(cache.url)
    }
  }, [cache])

  const ensureCard = useCallback((): Promise<Blob> => {
    if (cache.blob) return Promise.resolve(cache.blob)
    if (cache.pending) return cache.pending
    setIsGenerating(true)
    cache.pending = renderShareCard(cache.result).then(card => {
      if (!cache.active) throw new Error('Result closed')
      cache.blob = card
      cache.url = URL.createObjectURL(card)
      setPreviewUrl(cache.url)
      return card
    }).finally(() => {
      cache.pending = null
      if (cache.active) setIsGenerating(false)
    })
    return cache.pending
  }, [cache])

  const preparePreview = useCallback(async () => {
    try { await ensureCard() } catch {
      if (cache.active) setStatus({ message: '成績卡暫時無法產生，仍可複製文字成績。', tone: 'error' })
    }
  }, [ensureCard, cache])

  const copy = useCallback(async () => {
    const copied = await copyShareText(createShareText(result))
    if (cache.active) setStatus(copied ? { message: '成績已複製。', tone: 'success' } : { message: '無法自動複製，請稍後再試。', tone: 'error' })
  }, [result, cache])

  const download = useCallback(async () => {
    try {
      const card = await ensureCard()
      if (!cache.active) return
      const downloaded = downloadShareCard(card, createShareFilename(result))
      setStatus(downloaded ? { message: '成績卡已開始下載。', tone: 'success' } : { message: '下載未成功，請改用系統分享或稍後重試。', tone: 'error' })
    } catch {
      if (cache.active) setStatus({ message: '無法產生成績卡，請改用複製成績。', tone: 'error' })
    }
  }, [ensureCard, result, cache])

  let hasImageShare = false
  try {
    hasImageShare = !!cache.blob && !!navigator.canShare?.({ files: [new File([cache.blob], createShareFilename(result), { type: 'image/png' })] })
  } catch { /* Some browsers expose canShare without file support. */ }

  const systemShare = useCallback(async () => {
    if (!hasSystemShare) { setStatus({ message: '此瀏覽器未支援系統分享，請複製成績或下載成績卡。', tone: 'neutral' }); return }
    let image: File | undefined
    try {
      const card = await ensureCard()
      image = new File([card], createShareFilename(result), { type: 'image/png' })
    } catch { /* Text sharing remains available if the card cannot be drawn. */ }
    if (!cache.active) return
    const outcome = await shareResult(result, image)
    if (!cache.active) return
    if (outcome === 'shared') setStatus({ message: '已開啟系統分享。', tone: 'success' })
    if (outcome === 'failed') setStatus({ message: '系統分享沒有完成，請改用複製成績或下載成績卡。', tone: 'error' })
  }, [ensureCard, hasSystemShare, result, cache])

  return { copy, download, hasSystemShare, hasImageShare, isGenerating, preparePreview, previewUrl, status, systemShare }
}

export type ResultShareActions = ReturnType<typeof useShareResult>
