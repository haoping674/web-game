// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { OFFLINE_SECONDS, SAVE_KEY, formatAmount, islandReducer, newIsland, plantCost, production, readIsland, saveIsland, settle, upgradeCost } from './model'

beforeEach(() => localStorage.clear())

describe('Sprout Island growth and persistence', () => {
  it('merges only distinct matching residents, increasing production and freeing space', () => {
    const start = newIsland(0)
    expect(islandReducer(start, { type: 'merge', from: 0, to: 0 })).toBe(start)
    expect(islandReducer(start, { type: 'merge', from: 0, to: 2 })).toBe(start)
    const merged = islandReducer(start, { type: 'merge', from: 0, to: 1 })
    expect(merged.cells.slice(0, 3)).toEqual([0, 2, 0])
    expect(merged.best).toBe(2)
    expect(production(merged)).toBeGreaterThan(production(start))
  })
  it('charges for planting, rejects overspending, and allows a full island to recover', () => {
    let s = { ...newIsland(0), sunlight: 0n }
    expect(islandReducer(s, { type: 'plant' })).toBe(s)
    s = { ...s, sunlight: 1000n, cells: Array.from({ length: 12 }, (_, i) => i + 1) }
    expect(islandReducer(s, { type: 'plant' })).toBe(s)
    const released = islandReducer(s, { type: 'release', index: 11 })
    const planted = islandReducer(released, { type: 'plant' })
    expect(planted.cells[11]).toBe(1)
    expect(planted.sunlight).toBe(s.sunlight - plantCost(s) / 2n)
  })
  it('upgrades seeds only when a higher resident exists and the cost is affordable', () => {
    const s = { ...newIsland(0), sunlight: 1000n }
    expect(islandReducer(s, { type: 'upgrade' })).toBe(s)
    const merged = islandReducer(s, { type: 'merge', from: 0, to: 1 })
    const upgraded = islandReducer(merged, { type: 'upgrade' })
    expect(upgraded.seedLevel).toBe(2)
    expect(upgraded.sunlight).toBe(s.sunlight - upgradeCost(s))
    expect(islandReducer(upgraded, { type: 'plant' }).cells[0]).toBe(2)
  })
  it('restarts each voyage while keeping records and stacking permanent growth', () => {
    const initial = newIsland(0)
    expect(islandReducer(initial, { type: 'voyage' })).toBe(initial)
    const s = { ...initial, cells: [9, ...Array(11).fill(0)], best: 12, stars: 15n, seedLevel: 6 }
    const next = islandReducer(s, { type: 'voyage' })
    expect(next).toMatchObject({ stars: 17n, best: 12, seedLevel: 1, sunlight: 24n })
    expect(next.cells).toEqual(initial.cells)
    expect(production(next)).toBe(36n)
  })
  it('caps offline rewards, preserves fractional seconds, and never double claims time', () => {
    const initial = newIsland(0)
    expect(settle(initial, 500)).toBe(initial)
    const partial = settle(initial, 1500)
    expect(partial.sunlight).toBe(26n)
    expect(settle(partial, 2000).sunlight).toBe(28n)
    const later = settle(initial, 24 * 60 * 60 * 1000)
    expect(later.sunlight).toBe(24n + 2n * BigInt(OFFLINE_SECONDS))
    expect(settle(later, later.savedAt)).toBe(later)
  })
  it('round-trips huge values without losing precision and claims offline earnings once', () => {
    const s = { ...newIsland(1000), sunlight: 10n ** 100n, stars: 10n ** 30n }
    expect(saveIsland(s)).toBe(true)
    const loaded = readIsland(2000)
    expect(loaded.earned).toBe(production(s))
    expect(loaded.state.sunlight).toBe(s.sunlight + production(s))
    saveIsland(loaded.state)
    expect(readIsland(2000).earned).toBe(0n)
    expect(formatAmount(s.sunlight)).toBe('10.0e99')
  })
  it('recovers safely from broken saves and future timestamps', () => {
    localStorage.setItem(SAVE_KEY, '{broken')
    expect(readIsland(1000).state).toEqual(newIsland(1000))
    saveIsland(newIsland(5000))
    expect(readIsland(1000).state.savedAt).toBe(1000)
    const invalid = JSON.parse(localStorage.getItem(SAVE_KEY)!)
    invalid.cells[0] = -10
    localStorage.setItem(SAVE_KEY, JSON.stringify(invalid))
    expect(readIsland(1000).state).toEqual(newIsland(1000))
  })
})
