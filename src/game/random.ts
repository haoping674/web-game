export type RandomSource = () => number

export function createSeededRandom(seed: number): RandomSource {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
  }
}

export function randomInteger(random: RandomSource, minimum: number, maximum: number): number {
  return Math.floor(random() * (maximum - minimum + 1)) + minimum
}

export function shuffle<T>(values: readonly T[], random: RandomSource): T[] {
  const shuffled = [...values]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    const current = shuffled[index]
    const swap = shuffled[swapIndex]
    if (current !== undefined && swap !== undefined) {
      shuffled[index] = swap
      shuffled[swapIndex] = current
    }
  }
  return shuffled
}
