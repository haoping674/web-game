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
      { minimumCombo: 10, windowMs: 5_600 },
      { minimumCombo: 6, windowMs: 6_400 },
      { minimumCombo: 3, windowMs: 7_200 },
      { minimumCombo: 1, windowMs: 8_000 },
    ],
    clearAnimationMs: 400,
    particleScale: 1,
    burstScale: 1,
  },
  quick: {
    windows: [
      { minimumCombo: 10, windowMs: 5_000 },
      { minimumCombo: 6, windowMs: 5_600 },
      { minimumCombo: 3, windowMs: 6_200 },
      { minimumCombo: 1, windowMs: 6_800 },
    ],
    clearAnimationMs: 320,
    particleScale: 0.72,
    burstScale: 0.84,
  },
  hard: {
    windows: [
      { minimumCombo: 10, windowMs: 5_200 },
      { minimumCombo: 6, windowMs: 5_800 },
      { minimumCombo: 3, windowMs: 6_400 },
      { minimumCombo: 1, windowMs: 7_200 },
    ],
    clearAnimationMs: 380,
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
  return band?.windowMs ?? comboConfig[mode].windows.at(-1)?.windowMs ?? 8_000
}
