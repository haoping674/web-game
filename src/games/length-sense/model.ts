// Lengths use 1/10000 of the drawing rail, independent of device pixel density.
export const MIN_LENGTH = 500
export const MAX_LENGTH = 9500
export const INITIAL_LENGTH = 1200
export function randomLength(random = Math.random): number {
  return 2500 + Math.floor(Math.max(0, Math.min(.999999, random())) * 5501)
}
export function clampLength(value: number): number {
  return Math.max(MIN_LENGTH, Math.min(MAX_LENGTH, Math.round(value / 10) * 10))
}
export function judgeLength(target: number, guess: number) {
  const delta = guess - target
  const errorBp = Math.round(Math.abs(delta) / target * 10_000)
  const tier = errorBp <= 100 ? 'perfect' : errorBp <= 300 ? 'excellent' : errorBp <= 600 ? 'great' : errorBp <= 1000 ? 'close' : 'retry'
  const labels = { perfect: '分毫不差的眼力！', excellent: '你的眼睛就是尺！', great: '漂亮的長度感！', close: '再靠近一點點！', retry: '再抓一次感覺。' }
  return { target, guess, delta, errorBp, tier, label: labels[tier], score: Math.max(0, 1000 - Math.round(errorBp / 5)) } as const
}
export type LengthResult = ReturnType<typeof judgeLength>
