export const COMBO_TIERS = ['base', 'rising', 'charged', 'legendary', 'orchard'] as const
export type ComboTier = (typeof COMBO_TIERS)[number]

export const COMBO_MILESTONES = [5, 10, 15, 20] as const
export type ComboRating = 'Fresh' | 'Juicy' | 'Brilliant' | 'Fruit Flow'
export type ComboRatingInput = { combo: number; remainingRatio: number; validSuccess: boolean }

export function getComboTier(combo: number): ComboTier {
  if (combo >= 20) return 'orchard'
  if (combo >= 10) return 'legendary'
  if (combo >= 6) return 'charged'
  if (combo >= 3) return 'rising'
  return 'base'
}

export function getComboRating({ combo, remainingRatio, validSuccess }: ComboRatingInput): ComboRating {
  if (!validSuccess) return 'Fresh'
  if (combo >= 10) return 'Fruit Flow'
  if (combo >= 6 && remainingRatio >= 0.45) return 'Brilliant'
  if (combo >= 3 || remainingRatio >= 0.7) return 'Juicy'
  return 'Fresh'
}

export function getComboTitle(combo: number): string | null {
  return combo >= 10 ? 'Fruit Flow' : null
}

export function isComboMilestone(combo: number): boolean {
  return COMBO_MILESTONES.includes(combo as (typeof COMBO_MILESTONES)[number])
}
