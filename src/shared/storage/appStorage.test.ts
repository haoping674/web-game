import { describe, expect, it } from 'vitest'
import {
  APP_STORAGE_KEY,
  APP_STORAGE_VERSION,
  readAppStorage,
  markGameTutorialSeen,
  recordColorLinksResult,
  recordGameResult,
  resetGameProgress,
} from './appStorage'

function createStorage(initial: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value) },
    removeItem: (key) => { values.delete(key) },
    clear: () => values.clear(),
    key: (index) => [...values.keys()][index] ?? null,
    get length() { return values.size },
  }
}

describe('platform storage', () => {
  it('adds Ashbound to existing saves without changing other games', () => {
    const storage = createStorage({ [APP_STORAGE_KEY]: JSON.stringify({ games: { fruitSum: { highScore: 42, gamesPlayed: 3 }, sproutIsland: { highScore: 8, gamesPlayed: 2 } } }) })
    expect(readAppStorage(storage).games.ashbound).toEqual({ highScore: 0, gamesPlayed: 0 })
    recordGameResult('ashbound', 10, storage)
    expect(readAppStorage(storage).games.ashbound).toMatchObject({ highScore: 10, gamesPlayed: 1 })
    expect(readAppStorage(storage).games.fruitSum).toEqual({ highScore: 42, gamesPlayed: 3 })
    expect(readAppStorage(storage).games.sproutIsland).toEqual({ highScore: 8, gamesPlayed: 2 })
  })
  it('migrates legacy Orchard Ten progress and shared preferences without deleting the legacy record', () => {
    const legacy = JSON.stringify({
      version: 5,
      settings: { soundEnabled: false, animationsEnabled: true, animationIntensity: 'reduced' },
      statisticsByMode: {
        classic: { highScore: 31, gamesPlayed: 2 },
        quick: { highScore: 42, gamesPlayed: 3 },
        hard: { highScore: 18, gamesPlayed: 1 },
      },
    })
    const storage = createStorage({ 'orchard-ten-v2': legacy })
    const data = readAppStorage(storage)
    expect(data.version).toBe(APP_STORAGE_VERSION)
    expect(data.globalSettings).toEqual({
      soundEnabled: false,
      reducedMotion: true,
      effectIntensity: 'reduced',
    })
    expect(data.games.fruitSum).toMatchObject({ highScore: 31, gamesPlayed: 2 })
    expect(data.games.colorLinks).toMatchObject({ highScore: 0, gamesPlayed: 0 })
    expect(storage.getItem('orchard-ten-v2')).toBe(legacy)
    expect(storage.getItem(APP_STORAGE_KEY)).not.toBeNull()
  })

  it('keeps the two games independent when recording and clearing progress', () => {
    const storage = createStorage()
    recordGameResult('fruitSum', 24, storage, new Date('2026-01-01T00:00:00.000Z'))
    recordColorLinksResult({ kind: 'time-limit', removedTiles: 61 }, storage, new Date('2026-01-02T00:00:00.000Z'))
    recordColorLinksResult({ kind: 'cleared', completionSeconds: 14 }, storage, new Date('2026-01-03T00:00:00.000Z'))
    const recorded = readAppStorage(storage)
    expect(recorded.games.fruitSum).toMatchObject({ highScore: 24, gamesPlayed: 1 })
    expect(recorded.games.colorLinks).toMatchObject({ highScore: 61, bestTimeSeconds: 14, gamesPlayed: 2 })

    const tutorialMarked = markGameTutorialSeen('colorLinks', storage)
    expect(tutorialMarked.games.colorLinks.tutorialSeen).toBe(true)

    const reset = resetGameProgress('fruitSum', storage)
    expect(reset.games.fruitSum).toEqual({ highScore: 0, gamesPlayed: 0 })
    expect(reset.games.colorLinks).toMatchObject({ highScore: 61, bestTimeSeconds: 14, gamesPlayed: 2 })
  })

  it('keeps fastest clears and time-limit elimination records independent', () => {
    const storage = createStorage()
    recordColorLinksResult({ kind: 'cleared', completionSeconds: 22 }, storage)
    recordColorLinksResult({ kind: 'time-limit', removedTiles: 37 }, storage)
    recordColorLinksResult({ kind: 'cleared', completionSeconds: 25 }, storage)
    recordColorLinksResult({ kind: 'time-limit', removedTiles: 19 }, storage)

    expect(readAppStorage(storage).games.colorLinks).toMatchObject({
      bestTimeSeconds: 22,
      highScore: 37,
      gamesPlayed: 4,
    })
  })

  it('does not surface completion records that exceed the Color Links time limit', () => {
    const storage = createStorage({
      [APP_STORAGE_KEY]: JSON.stringify({
        version: APP_STORAGE_VERSION,
        globalSettings: { soundEnabled: true, reducedMotion: false, effectIntensity: 'full' },
        games: {
          fruitSum: { highScore: 0, gamesPlayed: 0 },
          colorLinks: { highScore: 41, bestTimeSeconds: 46, gamesPlayed: 3 },
        },
      }),
    })
    expect(readAppStorage(storage).games.colorLinks).toEqual({ highScore: 41, gamesPlayed: 3 })
  })

  it('falls back safely from corrupted platform and legacy JSON', () => {
    const data = readAppStorage(createStorage({
      [APP_STORAGE_KEY]: '{broken',
      'orchard-ten-v2': '{also-broken',
    }))
    expect(data.version).toBe(APP_STORAGE_VERSION)
    expect(data.games.fruitSum.highScore).toBe(0)
    expect(data.games.colorLinks.highScore).toBe(0)
  })
})
