// One decimal place keeps the announced target easy to remember.
export function randomSenseTarget(random = Math.random): number {
  const index = Math.max(0, Math.min(40, Math.floor(random() * 41)))
  return (10 + index) / 10
}
