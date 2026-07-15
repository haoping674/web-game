export const BOARD_ROWS = 10
export const BOARD_COLUMNS = 17
export const BOARD_SIZE = BOARD_ROWS * BOARD_COLUMNS
export const TARGET_SUM = 10
export const ROUND_SECONDS = 120

export const GAME_VERSION = '2.0.0'
export const STORAGE_KEY = 'orchard-ten-v2'
export const COMBO_WINDOW_MS = 4_000
export const HINT_LIMIT = 3
export const HINT_DURATION_MS = 1_600
export const CLEAR_ANIMATION_MS = 240
export const SCORE_MILESTONES = [3, 5, 10] as const
export const PERFORMANCE_TIERS = [
  { minimum: 0, label: '初次嘗試' },
  { minimum: 20, label: '漸入佳境' },
  { minimum: 45, label: '數字高手' },
  { minimum: 75, label: '消除達人' },
] as const

export const FRUIT_THEMES = [
  'berry', 'citrus', 'leaf', 'plum', 'melon', 'peach', 'apple', 'mint', 'sun',
] as const
