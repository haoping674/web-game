import { describe, expect, it } from 'vitest'
import { ColaRound, MAX_DISTANCE_CM, SEAL_BREAK } from './colaPhysics'

const dt = 1 / 120

function advance(round: ColaRound, time: number): void {
  for (let frame = 0; frame < Math.round(time / dt); frame++) round.step(dt)
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

  it('charges from vertical, diagonal and depth strokes and carries release momentum', () => {
    const round = new ColaRound()
    for (const [x, y, z] of [[0, 1, 0], [-1, -1, 0], [0, 0, 1], [0, -1, 0]]) {
      expect(round.shake(x, y, z)).toBe(true)
      advance(round, .26)
    }
    expect(round.pressure).toBeGreaterThan(.45)
    round.grab()
    round.moveGrip(.40, .095)
    advance(round, .075)
    expect(round.pose.x).toBeGreaterThan(.1)
    expect(round.pose.y).toBeGreaterThan(.02)
    const releasedX = round.pose.x
    round.release()
    advance(round, .025)
    expect(round.pose.x).toBeGreaterThan(releasedX)
    advance(round, 1.1)
    expect(Math.abs(round.pose.x)).toBeLessThan(.002)
  })

  it('leaks under the cap and completes opening automatically after a single activation', () => {
    const round = buildPressure(.26)
    round.beginOpening()
    advance(round, .54)
    expect(round.phase).toBe('opening')
    expect(round.opening).toBeGreaterThan(SEAL_BREAK)
    expect(round.distance).toBe(0)
    advance(round, .45)
    expect(round.phase).toBe('spray')
    expect(round.distance).toBe(0)
    advance(round, 3)
    expect(round.phase).toBe('result')
    expect(round.distance).toBeGreaterThan(0)
  })

  it('publishes an increasing series of actual landing distances within the board range', () => {
    const round = buildPressure(.26, 27)
    round.beginOpening()
    const distances: number[] = []
    for (let frame = 0; frame < 600 && round.phase !== 'result'; frame++) {
      round.step(dt)
      if (round.distance > 0 && round.distance !== distances.at(-1)) distances.push(round.distance)
    }
    expect(distances.length).toBeGreaterThan(4)
    expect(distances).toEqual([...distances].sort((a, b) => a - b))
    expect(round.distance).toBeGreaterThan(480)
    expect(round.distance).toBeLessThan(MAX_DISTANCE_CM)
  })
})
