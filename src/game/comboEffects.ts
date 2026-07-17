import type { ComboTier } from './comboTier'
import type { GridRect } from './types'
import type { ModeComboConfig } from './comboConfig'
import type { GameSettings } from './types'

export type EffectLevel = 'full' | 'reduced' | 'minimal' | 'off'

export type ComboClearEffect = {
  id: number
  rect: GridRect
  combo: number
  tier: ComboTier
  points: number
  durationMs: number
  particleScale: number
  burstScale: number
}

export function resolveEffectLevel(settings: GameSettings, prefersReducedMotion: boolean): EffectLevel {
  if (!settings.animationsEnabled || settings.animationIntensity === 'off') return 'off'
  if (settings.lowStimulus || prefersReducedMotion) return 'minimal'
  return settings.animationIntensity
}

export function createComboClearEffect(
  id: number,
  rect: GridRect,
  combo: number,
  points: number,
  config: ModeComboConfig,
  tier: ComboTier,
): ComboClearEffect {
  return { id, rect, combo, tier, points, durationMs: config.clearAnimationMs, particleScale: config.particleScale, burstScale: config.burstScale }
}
