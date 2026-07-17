import { getModeConfig } from './balanceConfig'

export const PLAYABLE_MODES = ['classic', 'quick', 'hard'] as const
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
    description: '兩分鐘標準節奏，適合穩定累積分數。',
    pace: '標準',
  },
  quick: {
    label: '快速',
    englishLabel: 'QUICK',
    description: '一分鐘短局，解法更直覺、節奏更俐落。',
    pace: '輕快',
  },
  hard: {
    label: '困難',
    englishLabel: 'HARD',
    description: '九十秒高壓挑戰，解法更少也更分散。',
    pace: '燒腦',
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
