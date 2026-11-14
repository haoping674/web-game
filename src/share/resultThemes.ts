import type { ArcadeGameId } from './types'

export const RESULT_THEMES: Record<ArcadeGameId, { accent: string; tint: string; mark: string }> = {
  secondSense: { accent: '#a54e2e', tint: '#f3e4ce', mark: '◷' },
  lengthSense: { accent: '#337a78', tint: '#deebe5', mark: '↔' },
  fruitSum: { accent: '#b44c3c', tint: '#f1e2cf', mark: '✦' },
  colorLinks: { accent: '#327b77', tint: '#dce8dc', mark: '◆' },
  slideTen: { accent: '#82604a', tint: '#ece4cd', mark: '→' },
}
