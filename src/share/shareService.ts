import { createShareText, createShareTitle, formatShareDate } from './shareText'
import type { ShareActionResult, ShareResult } from './types'

type ShareNavigator = { share?: Navigator['share']; canShare?: Navigator['canShare'] }

function isShareCancelled(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

export async function shareResult(result: ShareResult, image?: File, browser: ShareNavigator = navigator): Promise<ShareActionResult> {
  if (!browser.share) return 'unavailable'
  const payload: ShareData = { title: createShareTitle(result), text: createShareText(result), url: result.pageUrl }
  if (image && browser.canShare?.({ files: [image] })) payload.files = [image]
  try {
    await browser.share(payload)
    return 'shared'
  } catch (error) {
    return isShareCancelled(error) ? 'cancelled' : 'failed'
  }
}

export async function copyShareText(text: string, clipboard: Clipboard | undefined = navigator.clipboard, documentRef: Document = document): Promise<boolean> {
  try {
    if (clipboard?.writeText) { await clipboard.writeText(text); return true }
  } catch { /* try the selection fallback below */ }
  try {
    const textarea = documentRef.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    documentRef.body.append(textarea)
    textarea.select()
    const copied = documentRef.execCommand('copy')
    textarea.remove()
    return copied
  } catch { return false }
}

export function createShareFilename(result: ShareResult): string {
  const safeMode = result.mode.replace(/[^a-z0-9-]/gi, '') || 'result'
  return `orchard-ten-${safeMode}-${Math.max(0, Math.floor(result.score))}-${formatShareDate(result.playedAt)}.png`
}

export function downloadShareCard(blob: Blob, filename: string, documentRef: Document = document, urlApi: Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'> = URL): boolean {
  try {
    const objectUrl = urlApi.createObjectURL(blob)
    const anchor = documentRef.createElement('a')
    anchor.href = objectUrl
    anchor.download = filename
    anchor.style.display = 'none'
    documentRef.body.append(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => urlApi.revokeObjectURL(objectUrl), 0)
    return true
  } catch { return false }
}
