import type { PlayableMode } from './modes'

type ComboWindowBand = {
  minimumCombo: number
  windowMs: number
}

export type ModeComboConfig = {
  windows: readonly ComboWindowBand[]
  clearAnimationMs: number
  particleScale: number
  burstScale: number
}

/**
 * All mode-specific Combo timing and presentation pacing lives here. Window
 * values start after a successful clear and are never extended by pointer hold.
 */
export const comboConfig = {
  classic: {
    windows: [
      { minimumCombo: 10, windowMs: 2_800 },
      { minimumCombo: 6, windowMs: 3_200 },
      { minimumCombo: 3, windowMs: 3_600 },
      { minimumCombo: 1, windowMs: 4_000 },
    ],
    clearAnimationMs: 480,
    particleScale: 1,
    burstScale: 1,
  },
  quick: {
    windows: [
      { minimumCombo: 10, windowMs: 2_500 },
      { minimumCombo: 6, windowMs: 2_800 },
      { minimumCombo: 3, windowMs: 3_100 },
      { minimumCombo: 1, windowMs: 3_400 },
    ],
    clearAnimationMs: 340,
    particleScale: 0.72,
    burstScale: 0.84,
  },
  hard: {
    windows: [
      { minimumCombo: 10, windowMs: 2_600 },
      { minimumCombo: 6, windowMs: 2_900 },
      { minimumCombo: 3, windowMs: 3_200 },
      { minimumCombo: 1, windowMs: 3_600 },
    ],
    clearAnimationMs: 440,
    particleScale: 0.9,
    burstScale: 1.08,
  },
} as const satisfies Record<PlayableMode, ModeComboConfig>

export function getComboConfig(mode: PlayableMode): ModeComboConfig {
  return comboConfig[mode]
}

export function getComboWindowMs(mode: PlayableMode, combo: number): number {
  const normalizedCombo = Math.max(1, Math.floor(combo))
  const band = comboConfig[mode].windows.find(({ minimumCombo }) => normalizedCombo >= minimumCombo)
  return band?.windowMs ?? comboConfig[mode].windows.at(-1)?.windowMs ?? 4_000
}
