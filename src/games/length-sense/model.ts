export const LENGTH_TARGETS = [1, 3, 5] as const
export type LengthTarget = (typeof LENGTH_TARGETS)[number]
export const PX_PER_CM = 96 / 2.54
export const GROWTH_CM_PER_SECOND = 1.2
export function lengthAtElapsed(elapsedMs: number, maxCm: number): number {
  return Math.min(maxCm, Math.max(0, elapsedMs) / 1000 * GROWTH_CM_PER_SECOND)
}
export function judgeLength(target: number, lengthCm: number) {
  const guess = Math.round(Math.max(0, lengthCm) * 100) / 100
  const delta = Math.round((guess - target) * 100) / 100
  const errorBp = Math.round(Math.abs(delta) / target * 10_000)
  const tier = errorBp <= 100 ? 'perfect' : errorBp <= 300 ? 'excellent' : errorBp <= 600 ? 'great' : errorBp <= 1000 ? 'close' : 'retry'
  const labels = { perfect: '分毫不差的眼力！', excellent: '你的眼睛就是尺！', great: '漂亮的長度感！', close: '再靠近一點點！', retry: '再抓一次感覺。' }
  return { target, guess, delta, errorBp, tier, label: labels[tier], score: Math.max(0, 1000 - Math.round(errorBp / 5)) } as const
}
export type LengthResult = ReturnType<typeof judgeLength>
