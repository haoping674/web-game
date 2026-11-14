// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { judgeTiming } from '../games/second-sense/model'
import { judgeLength } from '../games/length-sense/model'
import { createGameState } from '../game/gameReducer'
import { createColorLinksState } from '../games/color-links/gameReducer'
import { createSlideState } from '../games/slide-ten/model'
import { colorShareResult, fruitShareResult, lengthShareResult, slideShareResult, timingShareResult } from './arcadeResults'
import { createShareText } from './shareText'
import { createShareFilename } from './shareService'

afterEach(() => window.history.replaceState(null, '', '/'))

describe('game result snapshots', () => {
  it('preserves a random target and its result even after navigation changes language', () => {
    window.history.replaceState(null, '', '/en/games/second-sense')
    const snapshot = timingShareResult(judgeTiming(2220, 2.2), true, true)
    window.history.replaceState(null, '', '/games/second-sense')
    expect(snapshot.value).toBe('0.020')
    expect(snapshot.stats).toContainEqual({ label: 'Target', value: '2.2 s' })
    expect(snapshot.stats).toContainEqual({ label: 'Challenge', value: 'Random target' })
    expect(snapshot.pageUrl).toBe('https://games.haoping.tw/en/games/second-sense')
    expect(createShareText(snapshot)).toContain('Your turn. Can you beat it?')
    expect(createShareFilename(snapshot)).toMatch(/^orchard-secondSense-0.020-\d{4}-\d{2}-\d{2}\.png$/)
  })

  it('uses percentage error for length and keeps the target and actual lines', () => {
    const snapshot = lengthShareResult(judgeLength(3, 3.02), false)
    expect(snapshot).toMatchObject({ value: '0.67', unit: '%', newBest: false, comparison: { target: 3, actual: 3.02 } })
  })

  it('distinguishes a Color Links clear time from a timed-out tile count', () => {
    const game = { ...createColorLinksState(), elapsedSeconds: 18, removedTiles: 100 }
    expect(colorShareResult({ ...game, outcome: 'cleared' }, true)).toMatchObject({ value: '18', unit: '秒' })
    expect(colorShareResult({ ...game, outcome: 'time-limit' }, false)).toMatchObject({ value: '100', unit: '格' })
  })

  it('gives every game its own canonical URL and immutable statistics', () => {
    const fruit = { ...createGameState(), score: 84, bestCombo: 14 }
    const slide = { ...createSlideState(), score: 42, elapsedMs: 147000 }
    const snapshots = [timingShareResult(judgeTiming(2997, 3), false, true), lengthShareResult(judgeLength(3, 3.02), true), fruitShareResult(fruit, true), colorShareResult({ ...createColorLinksState(), outcome: 'time-limit' }, false), slideShareResult(slide, false)]
    fruit.score = 0
    slide.elapsedMs = 0
    expect(new Set(snapshots.map(result => result.pageUrl)).size).toBe(5)
    expect(snapshots[2].value).toBe('84')
    expect(snapshots[4].stats).toContainEqual({ label: '守住果園', value: '2:27' })
    expect(snapshots.every(result => result.stats.length === 4)).toBe(true)
  })
})
