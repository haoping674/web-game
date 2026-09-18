export const SAVE_KEY = 'orchard-sprout-island-v1'
export const OFFLINE_SECONDS = 8 * 60 * 60
export type Island = {
  cells: number[]
  sunlight: bigint
  stars: bigint
  seedLevel: number
  best: number
  savedAt: number
}
export type Action = { type: 'tap' | 'plant' | 'upgrade' | 'voyage' } | { type: 'merge'; from: number; to: number } | { type: 'release'; index: number } | { type: 'tick'; now: number }

export function newIsland(now = Date.now()): Island {
  return { cells: [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], sunlight: 24n, stars: 0n, seedLevel: 1, best: 1, savedAt: now }
}
export const multiplier = (s: Island) => s.stars + 1n
export const plantCost = (s: Island) => 8n * 4n ** BigInt(s.seedLevel - 1)
export const upgradeCost = (s: Island) => 80n * 4n ** BigInt(s.seedLevel - 1)
export const production = (s: Island) => s.cells.reduce((sum, level) => sum + (level ? 3n ** BigInt(level - 1) : 0n), 0n) * multiplier(s)
export const tapValue = (s: Island) => multiplier(s) * 3n ** BigInt(s.seedLevel - 1)
export const islandLevel = (s: Island) => Math.max(1, ...s.cells)
export const voyageReward = (s: Island) => islandLevel(s) >= 8 ? BigInt(islandLevel(s) - 7) : 0n

export function settle(s: Island, now: number): Island {
  const seconds = Math.min(OFFLINE_SECONDS, Math.max(0, Math.floor((now - s.savedAt) / 1000)))
  if (!seconds) return s
  return { ...s, sunlight: s.sunlight + production(s) * BigInt(seconds), savedAt: now - Math.max(0, now - s.savedAt) % 1000 }
}

export function islandReducer(s: Island, action: Action): Island {
  switch (action.type) {
    case 'tick': return settle(s, action.now)
    case 'tap': return { ...s, sunlight: s.sunlight + tapValue(s) }
    case 'plant': {
      const slot = s.cells.indexOf(0)
      if (slot < 0 || s.sunlight < plantCost(s)) return s
      return { ...s, sunlight: s.sunlight - plantCost(s), cells: s.cells.map((level, i) => i === slot ? s.seedLevel : level) }
    }
    case 'merge': {
      const level = s.cells[action.from]
      if (!level || action.from === action.to || s.cells[action.to] !== level) return s
      return { ...s, cells: s.cells.map((value, i) => i === action.from ? 0 : i === action.to ? level + 1 : value), best: Math.max(s.best, level + 1) }
    }
    case 'upgrade':
      if (s.sunlight < upgradeCost(s) || s.seedLevel >= islandLevel(s)) return s
      return { ...s, sunlight: s.sunlight - upgradeCost(s), seedLevel: s.seedLevel + 1 }
    case 'release':
      if (!s.cells[action.index]) return s
      return { ...s, cells: s.cells.map((level, i) => i === action.index ? 0 : level), sunlight: s.sunlight + plantCost(s) / 2n }
    case 'voyage':
      if (!voyageReward(s)) return s
      return { ...newIsland(s.savedAt), best: s.best, stars: s.stars + voyageReward(s) }
  }
}

export function formatAmount(value: bigint): string {
  if (value < 1000n) return value.toString()
  const digits = value.toString()
  const group = Math.floor((digits.length - 1) / 3)
  const suffix = ['', 'K', 'M', 'B', 'T'][group]
  const lead = digits.slice(0, digits.length - group * 3)
  return `${lead}.${digits.slice(lead.length, lead.length + 1)}${suffix ?? `e${group * 3}`}`
}

export function readIsland(now = Date.now()): { state: Island; earned: bigint } {
  const fallback = { state: newIsland(now), earned: 0n }
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return fallback
    const data = JSON.parse(raw)
    const level = (n: unknown) => Number.isInteger(n) && Number(n) >= 1 && Number(n) <= 10000
    const amount = (n: unknown) => typeof n === 'string' && /^\d{1,10000}$/.test(n)
    if (!data || data.version !== 1 || !Array.isArray(data.cells) || data.cells.length !== 12
      || !data.cells.every((n: unknown) => n === 0 || level(n)) || !level(data.seedLevel) || !level(data.best)
      || !amount(data.sunlight) || !amount(data.stars) || !Number.isFinite(data.savedAt) || data.savedAt < 0) return fallback
    const state: Island = { cells: data.cells, seedLevel: data.seedLevel, best: Math.max(data.best, ...data.cells), sunlight: BigInt(data.sunlight), stars: BigInt(data.stars), savedAt: Math.min(now, data.savedAt) }
    const updated = settle(state, now)
    return { state: updated, earned: updated.sunlight - state.sunlight }
  } catch { return fallback }
}

export function saveIsland(s: Island): boolean {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...s, version: 1, sunlight: s.sunlight.toString(), stars: s.stars.toString() }))
    return true
  } catch { return false }
}
