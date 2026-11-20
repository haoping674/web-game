import { describe, expect, it } from 'vitest'
import { ColaRound, MAX_DISTANCE_CM, SEAL_BREAK } from './colaPhysics'

const dt = 1 / 120

function advance(round: ColaRound, time: number, held = false): void {
  for (let frame = 0; frame < Math.round(time / dt); frame++) round.step(dt, held)
}

function buildPressure(interval: number, beats = 13): ColaRound {
  const round = new ColaRound()
  for (let beat = 0; beat < beats; beat++) {
    round.shake(beat % 2 === 0 ? 1 : -1)
    advance(round, interval)
  }
  return round
}

describe('cola pressure and distance', () => {
  it('builds pressure on alternating strokes and rewards steady rhythm', () => {
    const round = new ColaRound()
    expect(round.shake(1)).toBe(true)
    advance(round, .26)
    expect(round.shake(1)).toBe(false)
    expect(round.shake(-1)).toBe(true)
    expect(round.shake(1)).toBe(false)
    expect(buildPressure(.26).pressure).toBeGreaterThan(buildPressure(.46).pressure)
  })

  it('leaks under the cap, resumes opening and scores only on impact', () => {
    const immediate = buildPressure(.26)
    const interrupted = buildPressure(.26)
    for (const round of [immediate, interrupted]) {
      round.beginOpening()
      advance(round, .54, true)
      expect(round.phase).toBe('opening')
      expect(round.opening).toBeGreaterThan(SEAL_BREAK)
      expect(round.distance).toBe(0)
    }
    const threadPosition = interrupted.opening
    const pressureBeforeLeak = interrupted.pressure
    advance(interrupted, .65)
    expect(interrupted.opening).toBe(threadPosition)
    expect(interrupted.pressure).toBeLessThan(pressureBeforeLeak)
    for (const round of [immediate, interrupted]) {
      advance(round, .45, true)
      expect(round.phase).toBe('spray')
      expect(round.distance).toBe(0)
      advance(round, 3)
      expect(round.phase).toBe('result')
      expect(round.distance).toBeGreaterThan(0)
    }
    expect(immediate.distance).toBeGreaterThan(interrupted.distance)
  })

  it('publishes an increasing series of actual landing distances within the board range', () => {
    const round = buildPressure(.26, 27)
    round.beginOpening()
    const distances: number[] = []
    for (let frame = 0; frame < 600 && round.phase !== 'result'; frame++) {
      round.step(dt, true)
      if (round.distance > 0 && round.distance !== distances.at(-1)) distances.push(round.distance)
    }
    expect(distances.length).toBeGreaterThan(4)
    expect(distances).toEqual([...distances].sort((a, b) => a - b))
    expect(round.distance).toBeGreaterThan(480)
    expect(round.distance).toBeLessThan(MAX_DISTANCE_CM)
  })
})
