import { STORAGE_KEY, STORAGE_SCHEMA_VERSION } from './constants'
import type { PlayableMode } from './modes'
import type { GameSettings, GameStatistics, StoredGameData } from './types'

export const defaultSettings: GameSettings = { soundEnabled: true, volume: 0.45, animationsEnabled: true, lowStimulus: false, showSelectionHelp: true }
export const defaultStatistics: GameStatistics = { highScore: 0, lastScore: 0, gamesPlayed: 0, totalCleared: 0, highestCombo: 0, totalScore: 0, bestClearsPerMinute: 0 }
export const defaultStatisticsByMode: Record<PlayableMode, GameStatistics> = {
  classic: defaultStatistics,
  quick: { ...defaultStatistics },
  hard: { ...defaultStatistics },
}
export const defaultStoredGameData: StoredGameData = { version: STORAGE_SCHEMA_VERSION, settings: defaultSettings, statisticsByMode: defaultStatisticsByMode, tutorialSeen: false }

function getStorage(storage: Storage | undefined): Storage | undefined {
  try { return storage ?? globalThis.localStorage } catch { return undefined }
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null }
function numberValue(value: unknown, fallback: number): number { return typeof value === 'number' && Number.isFinite(value) ? value : fallback }
function booleanValue(value: unknown, fallback: boolean): boolean { return typeof value === 'boolean' ? value : fallback }

function normalizeStatistics(value: unknown): GameStatistics {
  const statistics = isRecord(value) ? value : {}
  return { highScore: numberValue(statistics.highScore, 0), lastScore: numberValue(statistics.lastScore, 0), gamesPlayed: numberValue(statistics.gamesPlayed, 0), totalCleared: numberValue(statistics.totalCleared, 0), highestCombo: numberValue(statistics.highestCombo, 0), totalScore: numberValue(statistics.totalScore, 0), bestClearsPerMinute: numberValue(statistics.bestClearsPerMinute, 0) }
}

export function readGameData(storage?: Storage): StoredGameData {
  try {
    const raw = getStorage(storage)?.getItem(STORAGE_KEY)
    if (!raw) return defaultStoredGameData
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return defaultStoredGameData
    const settings = isRecord(parsed.settings) ? parsed.settings : {}
    const statisticsByMode = isRecord(parsed.statisticsByMode) ? parsed.statisticsByMode : {}
    const legacyStatistics = isRecord(parsed.statistics) ? parsed.statistics : undefined
    return {
      // Historical versions share this stable key. Only known fields are
      // normalised, so cache updates cannot affect player data.
      version: STORAGE_SCHEMA_VERSION,
      settings: { soundEnabled: booleanValue(settings.soundEnabled, defaultSettings.soundEnabled), volume: Math.max(0, Math.min(1, numberValue(settings.volume, defaultSettings.volume))), animationsEnabled: booleanValue(settings.animationsEnabled, defaultSettings.animationsEnabled), lowStimulus: booleanValue(settings.lowStimulus, defaultSettings.lowStimulus), showSelectionHelp: booleanValue(settings.showSelectionHelp, defaultSettings.showSelectionHelp) },
      statisticsByMode: {
        classic: normalizeStatistics(statisticsByMode.classic ?? legacyStatistics),
        quick: normalizeStatistics(statisticsByMode.quick),
        hard: normalizeStatistics(statisticsByMode.hard),
      },
      tutorialSeen: booleanValue(parsed.tutorialSeen, false),
    }
  } catch { return defaultStoredGameData }
}

export function saveGameData(data: StoredGameData, storage?: Storage): StoredGameData {
  try { getStorage(storage)?.setItem(STORAGE_KEY, JSON.stringify(data)) } catch { /* unavailable or quota-restricted */ }
  return data
}

export function clearGameData(storage?: Storage): StoredGameData {
  try { getStorage(storage)?.removeItem(STORAGE_KEY) } catch { /* unavailable */ }
  return defaultStoredGameData
}

export function recordFinishedRound(data: StoredGameData, mode: PlayableMode, score: number, cleared: number, bestCombo: number, clearsPerMinute: number): StoredGameData {
  const current = data.statisticsByMode[mode]
  const statistics = { highScore: Math.max(current.highScore, score), lastScore: score, gamesPlayed: current.gamesPlayed + 1, totalCleared: current.totalCleared + cleared, highestCombo: Math.max(current.highestCombo, bestCombo), totalScore: current.totalScore + score, bestClearsPerMinute: Math.max(current.bestClearsPerMinute, clearsPerMinute) }
  return { ...data, statisticsByMode: { ...data.statisticsByMode, [mode]: statistics } }
}
