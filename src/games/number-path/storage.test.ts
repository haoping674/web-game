// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { NUMBER_PATH_LEVELS } from './levels'
import { readNumberPathProgress, recordNumberPathCompletion, setShowSolvedNumbers } from './storage'

function levelAt(index: number): string {
  const id = NUMBER_PATH_LEVELS[index]?.id
  if (!id) throw new Error(`Missing level ${index}`)
  return id
}

describe('Number Path storage', () => {
  it('recovers from corrupt storage without affecting platform progress', () => {
    const storage = window.localStorage
    storage.clear()
    storage.setItem('orchard-arcade-number-path-v1', '{bad JSON')
    expect(readNumberPathProgress(storage).selectedDifficulty).toBe('easy')
  })

  it('records per-level results and unlocks only the following Number Path level', () => {
    const storage = window.localStorage
    storage.clear()
    const first = levelAt(0)
    const second = levelAt(1)
    const progress = recordNumberPathCompletion(first, 31, 2, 1, storage, new Date('2026-08-06T00:00:00.000Z'))
    expect(progress.completedByLevel[first]?.bestTimeSeconds).toBe(31)
    expect(progress.unlockedLevelIds).toContain(second)
    expect(setShowSolvedNumbers(true, storage).showSolvedNumbers).toBe(true)
  })
})
