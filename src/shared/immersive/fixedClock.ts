/** Fixed simulation clock with bounded catch-up after dropped frames. */
export function fixedClock(step: (seconds: number) => void, interval = 1 / 120) {
  let remainder = 0
  return {
    advance(seconds: number) {
      remainder += Math.min(seconds, interval * 6)
      while (remainder >= interval) {
        step(interval)
        remainder -= interval
      }
    },
    reset() { remainder = 0 },
  }
}
