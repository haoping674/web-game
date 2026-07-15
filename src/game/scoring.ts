import { PERFORMANCE_TIERS } from './constants'

export function getPerformanceLabel(score: number): string {
  return [...PERFORMANCE_TIERS].reverse().find((tier) => score >= tier.minimum)?.label ?? PERFORMANCE_TIERS[0].label
}

export function clearsPerMinute(cleared: number, secondsPlayed: number): number {
  if (secondsPlayed <= 0) return 0
  return Math.round((cleared / (secondsPlayed / 60)) * 10) / 10
}
