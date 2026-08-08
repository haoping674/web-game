import { NUMBER_PATH_LEVELS } from './levels'
import type { NumberPathCompletion, NumberPathDifficulty, NumberPathProgress } from './types'

const NUMBER_PATH_STORAGE_KEY = 'orchard-arcade-number-path-v1'

const DEFAULT_PROGRESS: NumberPathProgress = {
  unlockedLevelIds: [NUMBER_PATH_LEVELS[0]?.id ?? 'path-easy-01'],
  completedByLevel: {},
  selectedDifficulty: 'easy',
  showSolvedNumbers: false,
  tutorialSeen: false,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getStorage(storage?: Storage): Storage | undefined {
  try {
    return storage ?? globalThis.localStorage
  } catch {
    return undefined
  }
}

function difficultyOrFallback(value: unknown): NumberPathDifficulty {
  return value === 'easy' || value === 'normal' || value === 'hard' ? value : DEFAULT_PROGRESS.selectedDifficulty
}

function normalizeCompletion(value: unknown): NumberPathCompletion | undefined {
  if (!isRecord(value)) return undefined
  const bestTimeSeconds = typeof value.bestTimeSeconds === 'number' && Number.isFinite(value.bestTimeSeconds)
    ? Math.max(0, Math.floor(value.bestTimeSeconds))
    : undefined
  const leastErrors = typeof value.leastErrors === 'number' && Number.isFinite(value.leastErrors)
    ? Math.max(0, Math.floor(value.leastErrors))
    : undefined
  const hintsUsed = typeof value.hintsUsed === 'number' && Number.isFinite(value.hintsUsed)
    ? Math.max(0, Math.floor(value.hintsUsed))
    : undefined
  if (bestTimeSeconds === undefined || leastErrors === undefined || hintsUsed === undefined) return undefined
  return {
    bestTimeSeconds,
    leastErrors,
    hintsUsed,
    completedAt: typeof value.completedAt === 'string' ? value.completedAt : new Date(0).toISOString(),
  }
}

export function readNumberPathProgress(storage?: Storage): NumberPathProgress {
  try {
    const raw = getStorage(storage)?.getItem(NUMBER_PATH_STORAGE_KEY)
    if (!raw) return DEFAULT_PROGRESS
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return DEFAULT_PROGRESS
    const validIds = new Set(NUMBER_PATH_LEVELS.map((level) => level.id))
    const unlocked = Array.isArray(parsed.unlockedLevelIds)
      ? parsed.unlockedLevelIds.filter((id): id is string => typeof id === 'string' && validIds.has(id))
      : []
    const completedByLevel = isRecord(parsed.completedByLevel)
      ? Object.entries(parsed.completedByLevel).reduce<Record<string, NumberPathCompletion>>((result, [levelId, completion]) => {
          const normalized = validIds.has(levelId) ? normalizeCompletion(completion) : undefined
          if (normalized) result[levelId] = normalized
          return result
        }, {})
      : {}
    return {
      unlockedLevelIds: unlocked.length > 0 ? unlocked : DEFAULT_PROGRESS.unlockedLevelIds,
      completedByLevel,
      selectedDifficulty: difficultyOrFallback(parsed.selectedDifficulty),
      showSolvedNumbers: parsed.showSolvedNumbers === true,
      tutorialSeen: parsed.tutorialSeen === true,
    }
  } catch {
    return DEFAULT_PROGRESS
  }
}

export function saveNumberPathProgress(progress: NumberPathProgress, storage?: Storage): NumberPathProgress {
  try {
    getStorage(storage)?.setItem(NUMBER_PATH_STORAGE_KEY, JSON.stringify(progress))
  } catch {
    // Private browsing and quota errors must never stop a game.
  }
  return progress
}

export function setNumberPathDifficulty(difficulty: NumberPathDifficulty, storage?: Storage): NumberPathProgress {
  const current = readNumberPathProgress(storage)
  return saveNumberPathProgress({ ...current, selectedDifficulty: difficulty }, storage)
}

export function setShowSolvedNumbers(showSolvedNumbers: boolean, storage?: Storage): NumberPathProgress {
  const current = readNumberPathProgress(storage)
  return saveNumberPathProgress({ ...current, showSolvedNumbers }, storage)
}

export function setNumberPathTutorialSeen(storage?: Storage): NumberPathProgress {
  const current = readNumberPathProgress(storage)
  return saveNumberPathProgress({ ...current, tutorialSeen: true }, storage)
}

export function recordNumberPathCompletion(
  levelId: string,
  elapsedSeconds: number,
  errors: number,
  hintsUsed: number,
  storage?: Storage,
  completedAt = new Date(),
): NumberPathProgress {
  const current = readNumberPathProgress(storage)
  const previous = current.completedByLevel[levelId]
  const completion: NumberPathCompletion = {
    bestTimeSeconds: Math.min(previous?.bestTimeSeconds ?? Number.POSITIVE_INFINITY, Math.max(0, Math.floor(elapsedSeconds))),
    leastErrors: Math.min(previous?.leastErrors ?? Number.POSITIVE_INFINITY, Math.max(0, Math.floor(errors))),
    hintsUsed: Math.min(previous?.hintsUsed ?? Number.POSITIVE_INFINITY, Math.max(0, Math.floor(hintsUsed))),
    completedAt: completedAt.toISOString(),
  }
  const levelIndex = NUMBER_PATH_LEVELS.findIndex((level) => level.id === levelId)
  const nextLevelId = levelIndex >= 0 ? NUMBER_PATH_LEVELS[levelIndex + 1]?.id : undefined
  const unlockedLevelIds = nextLevelId && !current.unlockedLevelIds.includes(nextLevelId)
    ? [...current.unlockedLevelIds, nextLevelId]
    : current.unlockedLevelIds
  return saveNumberPathProgress({
    ...current,
    unlockedLevelIds,
    completedByLevel: { ...current.completedByLevel, [levelId]: completion },
  }, storage)
}
