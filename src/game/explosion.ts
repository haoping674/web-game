import type { ComboTier } from './comboTier'
import type { GridPoint, GridRect } from './types'

export type ExplosionParticleKind = 'juice' | 'seed' | 'rind' | 'spark'
export type ExplosionSource = { x: number; y: number }
export type ExplosionGeometry = { center: ExplosionSource; sources: readonly ExplosionSource[] }

export type ExplosionTierConfig = {
  particleCount: number
  radius: number
  hasSecondRing: boolean
  hasFramePulse: boolean
}

/**
 * Deliberately capped, board-local presentation settings. The cap is shared by
 * every mode; modes may only scale the values down, never make Combo 20 grow.
 */
export const explosionConfig = {
  base: { particleCount: 5, radius: 0.8, hasSecondRing: false, hasFramePulse: false },
  rising: { particleCount: 8, radius: 0.92, hasSecondRing: false, hasFramePulse: false },
  charged: { particleCount: 12, radius: 1.04, hasSecondRing: true, hasFramePulse: false },
  legendary: { particleCount: 16, radius: 1.14, hasSecondRing: true, hasFramePulse: true },
  orchard: { particleCount: 18, radius: 1.18, hasSecondRing: true, hasFramePulse: true },
} as const satisfies Record<ComboTier, ExplosionTierConfig>

export function getExplosionTierConfig(tier: ComboTier): ExplosionTierConfig {
  return explosionConfig[tier]
}

export function getParticleKind(index: number, tier: ComboTier): ExplosionParticleKind {
  if (tier === 'base') return index % 4 === 0 ? 'spark' : 'juice'
  if (tier === 'rising') return index % 5 === 0 ? 'seed' : index % 3 === 0 ? 'spark' : 'juice'
  if (tier === 'charged') return index % 5 === 0 ? 'rind' : index % 4 === 0 ? 'seed' : 'juice'
  return index % 6 === 0 ? 'rind' : index % 4 === 0 ? 'seed' : index % 3 === 0 ? 'spark' : 'juice'
}

function toScreenPoint(point: GridPoint, rows: number, columns: number, portrait: boolean): ExplosionSource {
  const x = portrait ? (point.row + 0.5) / rows : (point.column + 0.5) / columns
  const y = portrait ? (point.column + 0.5) / columns : (point.row + 0.5) / rows
  return { x: x * 100, y: y * 100 }
}

function fallbackCenter(rect: GridRect, rows: number, columns: number, portrait: boolean): ExplosionSource {
  return toScreenPoint({
    row: (rect.start.row + rect.end.row) / 2,
    column: (rect.start.column + rect.end.column) / 2,
  }, rows, columns, portrait)
}

/** Calculates a geometric center and no more than four real fruit origins. */
export function calculateExplosionGeometry(
  rect: GridRect,
  cells: readonly GridPoint[],
  rows: number,
  columns: number,
  portrait: boolean,
): ExplosionGeometry {
  if (cells.length === 0) {
    const center = fallbackCenter(rect, rows, columns, portrait)
    return { center, sources: [center] }
  }

  const points = cells.map((cell) => toScreenPoint(cell, rows, columns, portrait))
  const center = points.reduce((total, point) => ({ x: total.x + point.x, y: total.y + point.y }), { x: 0, y: 0 })
  center.x /= points.length
  center.y /= points.length
  const sourceCount = Math.min(4, Math.max(1, Math.ceil(points.length / 3)))
  const sources = Array.from({ length: sourceCount }, (_, index) => points[Math.round((index * (points.length - 1)) / Math.max(1, sourceCount - 1))]!)
  return { center, sources }
}
