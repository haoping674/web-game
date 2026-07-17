import { describe, expect, it } from 'vitest'
import { STORAGE_KEY, STORAGE_SCHEMA_VERSION } from './constants'
import { defaultSettings, readGameData } from './storage'

function createStorage(value: string): Storage {
  const values = new Map([[STORAGE_KEY, value]])
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, next) => { values.set(key, next) },
    removeItem: (key) => { values.delete(key) },
    clear: () => values.clear(),
    key: () => null,
    get length() { return values.size },
  }
}

describe('readGameData migration', () => {
  it('normalises incomplete historical data without changing its storage key', () => {
    const data = readGameData(createStorage(JSON.stringify({ version: 1, settings: { volume: 9 }, statistics: { highScore: 42 } })))
    expect(data.version).toBe(STORAGE_SCHEMA_VERSION)
    expect(data.settings).toEqual({ ...defaultSettings, volume: 1 })
    expect(data.statisticsByMode.classic.highScore).toBe(42)
    expect(data.statisticsByMode.classic.gamesPlayed).toBe(0)
    expect(data.statisticsByMode.quick.highScore).toBe(0)
  })

  it('falls back safely when local JSON is corrupted', () => {
    expect(readGameData(createStorage('{not-json')).version).toBe(STORAGE_SCHEMA_VERSION)
  })

  it('migrates the legacy animation toggle and keeps new preference fields', () => {
    const data = readGameData(createStorage(JSON.stringify({
      version: 4,
      settings: { animationsEnabled: false, hapticsEnabled: false },
      mobileGestureHintSeen: true,
    })))
    expect(data.settings.animationIntensity).toBe('off')
    expect(data.settings.animationsEnabled).toBe(false)
    expect(data.settings.hapticsEnabled).toBe(false)
    expect(data.mobileGestureHintSeen).toBe(true)
  })
})
