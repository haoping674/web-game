import { getModeConfig } from './balanceConfig'

export const PLAYABLE_MODES = ['classic'] as const
export type PlayableMode = (typeof PLAYABLE_MODES)[number]

export type PlayableModeDetails = {
  label: string
  englishLabel: string
  description: string
  pace: string
}

export const PLAYABLE_MODE_DETAILS = {
  classic: {
    label: '經典',
    englishLabel: 'CLASSIC',
    description: '120 秒內盡可能多消除水果，累積 Combo。',
    pace: '標準節奏',
  },
} as const satisfies Record<PlayableMode, PlayableModeDetails>

export function getModeRoundSeconds(mode: PlayableMode): number {
  const seconds = getModeConfig(mode).roundSeconds
  if (seconds === null) throw new Error(`Playable mode ${mode} must have a time limit`)
  return seconds
}

export function getModeHintLimit(mode: PlayableMode): number {
  return getModeConfig(mode).hintLimit
}
