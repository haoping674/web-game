/** Hysteresis keeps resolution from changing during small variations in frame time. */
export function adaptiveResolution(deviceLimit: number) {
  let scale = deviceLimit
  let slow = 0
  let fast = 0
  const minimum = Math.min(0.65, deviceLimit)

  return {
    get scale() { return scale },
    observe(seconds: number): boolean {
      if (seconds <= 0) return false
      slow = seconds > 0.026 ? slow + seconds : Math.max(0, slow - seconds * 2)
      fast = seconds < 0.018 ? fast + seconds : 0
      const next = slow > 1.1 ? Math.max(minimum, scale - 0.22) : fast > 7 ? Math.min(deviceLimit, scale + 0.12) : scale
      if (next === scale) return false
      scale = next
      slow = fast = 0
      return true
    },
  }
}
