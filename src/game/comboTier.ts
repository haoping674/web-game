export const COMBO_TIERS = ['base', 'rising', 'charged', 'legendary'] as const
export type ComboTier = (typeof COMBO_TIERS)[number]

export function getComboTier(combo: number): ComboTier {
  if (combo >= 10) return 'legendary'
  if (combo >= 6) return 'charged'
  if (combo >= 3) return 'rising'
  return 'base'
}

export function getComboTitle(combo: number): string | null {
  if (combo < 10) return null
  if (combo >= 20) return '果園星潮'
  return '十果流星'
}

export function isComboMilestone(combo: number): boolean {
  return combo === 5 || combo === 10 || combo === 20
}
