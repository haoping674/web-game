// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { renderShareCard } from './shareCardRenderer'
import { copyShareText, createShareFilename, downloadShareCard, shareResult } from './shareService'
import type { ShareResult } from './types'

const result: ShareResult = { mode: 'classic', score: 72, maxCombo: 8, clearedFruitCount: 72, successfulMoves: 20, playedAt: new Date('2026-07-16T12:00:00Z'), pageUrl: 'https://orchard-ten.example/play' }

describe('share service fallbacks', () => {
  it('reports unavailable when Web Share API is absent', async () => {
    await expect(shareResult(result, undefined, {})).resolves.toBe('unavailable')
  })

  it('does not treat a cancelled system share as an error', async () => {
    await expect(shareResult(result, undefined, { share: vi.fn().mockRejectedValue(new DOMException('Cancelled', 'AbortError')) })).resolves.toBe('cancelled')
  })

  it('uses Clipboard API and falls back to a selection copy after failure', async () => {
    const clipboard = { writeText: vi.fn().mockResolvedValue(undefined) } as unknown as Clipboard
    await expect(copyShareText('score', clipboard)).resolves.toBe(true)
    expect(clipboard.writeText).toHaveBeenCalledWith('score')
    const execCommand = vi.fn().mockReturnValue(true)
    Object.assign(document, { execCommand })
    await expect(copyShareText('score', { writeText: vi.fn().mockRejectedValue(new Error('denied')) } as unknown as Clipboard)).resolves.toBe(true)
    expect(execCommand).toHaveBeenCalledWith('copy')
  })

  it('creates a safe download name and revokes its object URL', () => {
    expect(createShareFilename({ ...result, mode: 'daily/unsafe' as ShareResult['mode'] })).toBe('orchard-ten-dailyunsafe-72-2026-07-16.png')
    const click = vi.fn()
    const anchor = { href: '', download: '', style: { display: '' }, click, remove: vi.fn() }
    const documentRef = { createElement: vi.fn().mockReturnValue(anchor), body: { append: vi.fn() } } as unknown as Document
    const revokeObjectURL = vi.fn()
    vi.useFakeTimers()
    expect(downloadShareCard(new Blob(['card']), 'orchard-ten.png', documentRef, { createObjectURL: vi.fn().mockReturnValue('blob:card'), revokeObjectURL })).toBe(true)
    vi.runAllTimers()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:card')
    vi.useRealTimers()
  })
})

describe('share card rendering', () => {
  it('produces a PNG blob without any board data', async () => {
    const gradient = { addColorStop: vi.fn() }
    const context = {
      beginPath: vi.fn(), createLinearGradient: vi.fn().mockReturnValue(gradient), ellipse: vi.fn(), fill: vi.fn(), fillRect: vi.fn(), fillText: vi.fn(), roundRect: vi.fn(), strokeRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D
    const canvas = { width: 0, height: 0, getContext: vi.fn().mockReturnValue(context), toBlob: (callback: BlobCallback) => callback(new Blob(['card'], { type: 'image/png' })) } as unknown as HTMLCanvasElement
    await expect(renderShareCard(result, () => canvas)).resolves.toMatchObject({ type: 'image/png' })
    expect(canvas.width).toBe(1080)
    expect(canvas.height).toBe(1350)
  })
})
