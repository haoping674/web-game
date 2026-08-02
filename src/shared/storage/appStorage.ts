import type { GameId } from '../../app/gameRegistry'

export const APP_STORAGE_KEY = 'orchard-arcade-v1'
export const APP_STORAGE_VERSION = 1
const LEGACY_FRUIT_STORAGE_KEY = 'orchard-ten-v2'

export type EffectIntensity = 'full' | 'reduced' | 'off'

export type GlobalSettings = {
  soundEnabled: boolean
  reducedMotion: boolean
  effectIntensity: EffectIntensity
}

export type GameProgress = {
  highScore: number
  gamesPlayed: number
  lastPlayedAt?: string
}

export type AppStorage = {
  version: number
  globalSettings: GlobalSettings
  games: Record<GameId, GameProgress>
}

const DEFAULT_PROGRESS: GameProgress = { highScore: 0, gamesPlayed: 0 }
export const DEFAULT_APP_STORAGE: AppStorage = {
  version: APP_STORAGE_VERSION,
  globalSettings: { soundEnabled: true, reducedMotion: false, effectIntensity: 'full' },
  games: {
    fruitSum: DEFAULT_PROGRESS,
    colorLinks: { ...DEFAULT_PROGRESS },
  },
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function finiteNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : fallback
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function intensityValue(value: unknown, fallback: EffectIntensity): EffectIntensity {
  return value === 'full' || value === 'reduced' || value === 'off' ? value : fallback
}

function normalizeProgress(value: unknown): GameProgress {
  const progress = isRecord(value) ? value : {}
  const lastPlayedAt = typeof progress.lastPlayedAt === 'string' ? progress.lastPlayedAt : undefined
  const normalized: GameProgress = {
    highScore: finiteNumber(progress.highScore),
    gamesPlayed: finiteNumber(progress.gamesPlayed),
  }
  return lastPlayedAt ? { ...normalized, lastPlayedAt } : normalized
}

function getStorage(storage?: Storage): Storage | undefined {
  try {
    return storage ?? globalThis.localStorage
  } catch {
    return undefined
  }
}

function readLegacyFruitProgress(storage: Storage | undefined): {
  progress: GameProgress
  settings?: GlobalSettings
} {
  try {
    const raw = storage?.getItem(LEGACY_FRUIT_STORAGE_KEY)
    if (!raw) return { progress: DEFAULT_PROGRESS }
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return { progress: DEFAULT_PROGRESS }
    const statisticsByMode = isRecord(parsed.statisticsByMode) ? parsed.statisticsByMode : {}
    const legacyStatistics = isRecord(parsed.statistics) ? parsed.statistics : {}
    const classicStatistics = isRecord(statisticsByMode.classic) ? statisticsByMode.classic : legacyStatistics
    const progress = {
      highScore: finiteNumber(classicStatistics.highScore),
      gamesPlayed: finiteNumber(classicStatistics.gamesPlayed),
    }
    const settingsRecord = isRecord(parsed.settings) ? parsed.settings : undefined
    if (!settingsRecord) return { progress }
    const animationsEnabled = booleanValue(settingsRecord.animationsEnabled, true)
    const effectIntensity = intensityValue(settingsRecord.animationIntensity, animationsEnabled ? 'full' : 'off')
    return {
      progress,
      settings: {
        soundEnabled: booleanValue(settingsRecord.soundEnabled, true),
        reducedMotion: effectIntensity !== 'full',
        effectIntensity,
      },
    }
  } catch {
    return { progress: DEFAULT_PROGRESS }
  }
}

export function readAppStorage(storage?: Storage): AppStorage {
  const target = getStorage(storage)
  const legacy = readLegacyFruitProgress(target)
  try {
    const raw = target?.getItem(APP_STORAGE_KEY)
    if (!raw) {
      const migrated: AppStorage = {
        ...DEFAULT_APP_STORAGE,
        globalSettings: legacy.settings ?? DEFAULT_APP_STORAGE.globalSettings,
        games: { ...DEFAULT_APP_STORAGE.games, fruitSum: legacy.progress },
      }
      saveAppStorage(migrated, target)
      return migrated
    }
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) throw new Error('Invalid platform storage')
    const settings = isRecord(parsed.globalSettings) ? parsed.globalSettings : {}
    const games = isRecord(parsed.games) ? parsed.games : {}
    const storedFruit = normalizeProgress(games.fruitSum)
    return {
      version: APP_STORAGE_VERSION,
      globalSettings: {
        soundEnabled: booleanValue(settings.soundEnabled, legacy.settings?.soundEnabled ?? true),
        reducedMotion: booleanValue(settings.reducedMotion, legacy.settings?.reducedMotion ?? false),
        effectIntensity: intensityValue(settings.effectIntensity, legacy.settings?.effectIntensity ?? 'full'),
      },
      games: {
        fruitSum: {
          ...storedFruit,
          highScore: Math.max(storedFruit.highScore, legacy.progress.highScore),
          gamesPlayed: Math.max(storedFruit.gamesPlayed, legacy.progress.gamesPlayed),
        },
        colorLinks: normalizeProgress(games.colorLinks),
      },
    }
  } catch {
    return {
      ...DEFAULT_APP_STORAGE,
      globalSettings: legacy.settings ?? DEFAULT_APP_STORAGE.globalSettings,
      games: { ...DEFAULT_APP_STORAGE.games, fruitSum: legacy.progress },
    }
  }
}

export function saveAppStorage(data: AppStorage, storage?: Storage): AppStorage {
  try {
    getStorage(storage)?.setItem(APP_STORAGE_KEY, JSON.stringify({ ...data, version: APP_STORAGE_VERSION }))
  } catch {
    // Storage can be unavailable or quota-restricted.
  }
  return data
}

export function updateGlobalSettings(settings: GlobalSettings, storage?: Storage): AppStorage {
  const current = readAppStorage(storage)
  return saveAppStorage({ ...current, globalSettings: settings }, storage)
}

export function recordGameResult(gameId: GameId, score: number, storage?: Storage, playedAt = new Date()): AppStorage {
  const current = readAppStorage(storage)
  const progress = current.games[gameId]
  return saveAppStorage({
    ...current,
    games: {
      ...current.games,
      [gameId]: {
        highScore: Math.max(progress.highScore, score),
        gamesPlayed: progress.gamesPlayed + 1,
        lastPlayedAt: playedAt.toISOString(),
      },
    },
  }, storage)
}

export function resetGameProgress(gameId: GameId, storage?: Storage): AppStorage {
  const current = readAppStorage(storage)
  return saveAppStorage({
    ...current,
    games: { ...current.games, [gameId]: { ...DEFAULT_PROGRESS } },
  }, storage)
}
