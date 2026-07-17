import { describe, expect, it } from 'vitest'
import { createShareText } from './shareText'
import type { ShareResult } from './types'

const classic: ShareResult = { mode: 'classic', score: 72, maxCombo: 8, clearedFruitCount: 72, successfulMoves: 20, playedAt: new Date('2026-07-16T12:00:00Z'), pageUrl: 'https://orchard-ten.example/play' }

describe('share text', () => {
  it('includes the correct classic score and mode', () => {
    const text = createShareText(classic)
    expect(text).toContain('經典模式獲得 72 分')
    expect(text).toContain('最高 Combo 8')
  })

  it('labels quick and hard results independently', () => {
    expect(createShareText({ ...classic, mode: 'quick' })).toContain('快速模式')
    expect(createShareText({ ...classic, mode: 'hard' })).toContain('困難模式')
  })

  it('includes a daily challenge identifier only for daily results', () => {
    expect(createShareText({ ...classic, mode: 'daily', dailyChallengeId: '20260716' })).toContain('每日挑戰 #20260716')
    expect(createShareText(classic)).not.toContain('每日挑戰')
  })

  it('never serializes board data or a solution', () => {
    const resultWithHiddenBoard = { ...classic, board: [[1, 9]], seed: 'secret-solution' } as ShareResult
    const text = createShareText(resultWithHiddenBoard)
    expect(text).not.toContain('secret-solution')
    expect(text).not.toContain('1,9')
  })
})
