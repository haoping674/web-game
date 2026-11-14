import { translate, isEnglish } from '../app/translate'
import type { LegacyShareResult, ShareResult } from './types'

export const GAME_NAME = 'Orchard Ten'
export const SHARE_INVITATION = '來挑戰 Orchard Ten，看看你能消除多少水果！'

export function formatShareDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function shareModeLabel(mode: LegacyShareResult['mode']): string {
  switch (mode) {
    case 'classic': return translate('經典模式')
    case 'daily': return '每日挑戰'
    default: return assertNever(mode)
  }
}

export function createShareText(result: ShareResult): string {
  if ('kind' in result) {
    const invitation = result.locale === 'en' ? 'Your turn. Can you beat it?' : '換你挑戰，能超越這個成績嗎？'
    return [result.gameName, `${result.metricLabel} ${result.value} ${result.unit}`, ...result.stats.map(stat => `${stat.label} ${stat.value}`), invitation, result.pageUrl].join('\n')
  }
  if (isEnglish()) {
    return [`I scored ${result.score} points in Orchard Ten!`, `Cleared ${result.clearedFruitCount} fruit. Best Combo: ${result.maxCombo}.`, 'Try Orchard Ten and see how much fruit you can clear!', result.pageUrl].join('\n')
  }
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
  if ('kind' in result) return `${result.gameName} · ${result.value} ${result.unit}`
  return `${GAME_NAME}｜${shareModeLabel(result.mode)} ${result.score} 分`
}

function assertNever(value: never): never {
  throw new Error(`Unknown share mode: ${String(value)}`)
}
