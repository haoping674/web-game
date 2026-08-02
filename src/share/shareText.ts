import type { ShareResult } from './types'

export const GAME_NAME = 'Orchard Ten'
export const SHARE_INVITATION = '來挑戰 Orchard Ten，看看你能消除多少水果！'

export function formatShareDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function shareModeLabel(mode: ShareResult['mode']): string {
  switch (mode) {
    case 'classic': return '經典模式'
    case 'daily': return '每日挑戰'
    default: return assertNever(mode)
  }
}

export function createShareText(result: ShareResult): string {
  const lines = result.mode === 'daily'
    ? [
        `我在 ${GAME_NAME} 完成每日挑戰 #${result.dailyChallengeId ?? formatShareDate(result.playedAt).replaceAll('-', '')}！`,
        `分數：${result.score}`,
        `消除了 ${result.clearedFruitCount} 顆水果，最高 Combo ${result.maxCombo}。`,
      ]
    : [
        `我在 ${GAME_NAME} 的${shareModeLabel(result.mode)}拿到 ${result.score} 分！`,
        `消除了 ${result.clearedFruitCount} 顆水果，最高 Combo ${result.maxCombo}。`,
      ]

  return [...lines, SHARE_INVITATION, result.pageUrl].join('\n')
}

export function createShareTitle(result: ShareResult): string {
  return `${GAME_NAME}｜${shareModeLabel(result.mode)} ${result.score} 分`
}

function assertNever(value: never): never {
  throw new Error(`Unknown share mode: ${String(value)}`)
}
