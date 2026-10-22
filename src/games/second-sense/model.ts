export const TARGETS = [1, 3, 5] as const
export type Target = (typeof TARGETS)[number]
export type TimingResult = ReturnType<typeof judgeTiming>

export function judgeTiming(elapsedMs: number, target: number) {
  const elapsed = Math.max(0, Math.round(elapsedMs))
  const delta = elapsed - Math.round(target * 1000)
  const error = Math.abs(delta)
  const tier = error <= 30 ? 'perfect' : error <= 80 ? 'excellent' : error <= 150 ? 'great' : error <= 300 ? 'close' : 'retry'
  const labels = { perfect: '完美瞬間！', excellent: '神乎其技！', great: '漂亮的手感！', close: '就差一點點！', retry: '再找找節奏。' }
  return { elapsed, delta, error, target, tier, label: labels[tier], score: Math.max(0, 1000 - error) } as const
}
