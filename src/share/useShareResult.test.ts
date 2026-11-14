// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useShareResult } from './useShareResult'
import { renderShareCard } from './shareCardRenderer'
import type { LegacyShareResult } from './types'

vi.mock('./shareCardRenderer', () => ({ renderShareCard: vi.fn() }))
const result: LegacyShareResult = { mode: 'classic', score: 42, maxCombo: 4, clearedFruitCount: 42, successfulMoves: 15, playedAt: new Date(), pageUrl: 'https://games.haoping.tw/games/fruit-sum' }
const createObjectURL = vi.fn(() => 'blob:card')
const revokeObjectURL = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  const OriginalURL = URL
  vi.stubGlobal('URL', class extends OriginalURL {
    static createObjectURL = createObjectURL
    static revokeObjectURL = revokeObjectURL
  })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('result card lifecycle', () => {
  it('shares one in-flight render and revokes the preview when closed', async () => {
    let resolve!: (blob: Blob) => void
    vi.mocked(renderShareCard).mockReturnValue(new Promise(done => { resolve = done }))
    const view = renderHook(() => useShareResult(result))
    let first!: Promise<void>
    let second!: Promise<void>
    act(() => { first = view.result.current.preparePreview(); second = view.result.current.preparePreview() })
    expect(renderShareCard).toHaveBeenCalledTimes(1)
    await act(async () => { resolve(new Blob(['png'], { type: 'image/png' })); await Promise.all([first, second]) })
    expect(view.result.current.previewUrl).toBe('blob:card')
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    view.unmount()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:card')
  })

  it('discards a render that finishes after the result has closed', async () => {
    let resolve!: (blob: Blob) => void
    vi.mocked(renderShareCard).mockReturnValue(new Promise(done => { resolve = done }))
    const view = renderHook(() => useShareResult(result))
    let pending!: Promise<void>
    act(() => { pending = view.result.current.preparePreview() })
    view.unmount()
    await act(async () => { resolve(new Blob(['png'])); await pending })
    expect(createObjectURL).not.toHaveBeenCalled()
  })
})
