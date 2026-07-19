import type { ComboRating, ComboTier } from './comboTier'
import type { GridPoint, GridRect } from './types'
import type { ModeComboConfig } from './comboConfig'
import type { GameSettings } from './types'
import type { FruitRemovedEvent } from './fruitParticles'

export type EffectLevel = 'full' | 'reduced' | 'minimal' | 'off'

export type ComboClearEffect = {
  id: number
  rect: GridRect
  cells: readonly GridPoint[]
  combo: number
  tier: ComboTier
  rating: ComboRating
  milestone: boolean
  points: number
  durationMs: number
  particleScale: number
  burstScale: number
  fruitEvent: FruitRemovedEvent
}

export function resolveEffectLevel(settings: GameSettings, prefersReducedMotion: boolean): EffectLevel {
  if (!settings.animationsEnabled || settings.animationIntensity === 'off') return 'off'
  if (settings.lowStimulus || prefersReducedMotion) return 'minimal'
  return settings.animationIntensity
}

export function createComboClearEffect(
  id: number,
  rect: GridRect,
  cells: readonly GridPoint[],
  combo: number,
  points: number,
  config: ModeComboConfig,
  tier: ComboTier,
  rating: ComboRating,
  milestone: boolean,
  fruitEvent: FruitRemovedEvent,
): ComboClearEffect {
  return { id, rect, cells, combo, tier, rating, milestone, points, durationMs: config.clearAnimationMs, particleScale: config.particleScale, burstScale: config.burstScale, fruitEvent }
}
