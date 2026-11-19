import { describe, expect, it } from 'vitest'
import { BOX_HEIGHT, BOX_LENGTH, FLOOR, PaperPhysics, SHEET_ROWS } from './paperPhysics'

function setup() {
  const draws: number[] = []
  const model = new PaperPhysics({ draw: (strength) => draws.push(strength) })
  const advance = (steps: number) => { for (let i = 0; i < steps; i++) model.step(1 / 120) }
  return { model, draws, advance }
}

describe('boxed tissue interaction', () => {
  it('feeds part of a sheet under a short pull and permits a new grip after release', () => {
    const { model, draws, advance } = setup()
    const column = 7
    const row = model.rows.length - 1
    const point = model.rows[row].points[column].position.clone()
    expect(model.grab(row, column, point)).toBe(true)
    model.move(point.clone().setY(point.y + 0.44))
    advance(36)
    model.release()
    advance(80)
    expect(model.produced).toBeGreaterThan(0.04)
    expect(draws).toEqual([])
    expect(model.grab(model.rows.length - 1, column, model.rows.at(-1)!.points[column].position)).toBe(true)
  })

  it('draws the overlapping next sheet before the first sheet leaves the box', () => {
    const { model, draws, advance } = setup()
    model.pull(false)
    let sawOverlap = false
    let secondSheet = model.upcoming
    for (let i = 0; i < 185; i++) {
      advance(1)
      if (draws.length) break
      if (model.upcoming.length > 1) {
        sawOverlap = true
        secondSheet = model.upcoming
        expect(model.offcuts).toHaveLength(0)
      }
    }
    expect(sawOverlap).toBe(true)
    expect(draws).toHaveLength(1)
    expect(model.rows).toBe(secondSheet)
    expect(model.offcuts[0].rows).toHaveLength(SHEET_ROWS)
    const tip = model.rows.at(-1)!.points[7].position
    expect(tip.y).toBeGreaterThan(FLOOR + BOX_HEIGHT + 0.14)
  })

  it('keeps a manually extracted sheet in the grip until the player releases it', () => {
    const { model, draws, advance } = setup()
    const row = model.rows.length - 1
    const origin = model.rows[row].points[7].position.clone()
    expect(model.grab(row, 7, origin)).toBe(true)
    model.move(origin.clone().setY(origin.y + 2.2))
    advance(85)
    expect(draws).toHaveLength(1)
    expect(model.grip?.piece).toBe(model.offcuts[0])
    expect(model.offcuts[0].age).toBe(0)
    const lifted = origin.clone().addScalar(1.9)
    model.move(lifted)
    advance(75)
    expect(model.grip?.point.position.distanceTo(lifted)).toBeLessThan(0.15)
    model.release()
    advance(60)
    expect(model.grip).toBeNull()
    expect(model.offcuts[0].age).toBeGreaterThan(0)
  })

  it('transmits an angled pull to the box and keeps repeated draws stable', () => {
    const { model, draws, advance } = setup()
    model.pull(true)
    advance(65)
    expect(Math.abs(model.box.x)).toBeGreaterThan(0.045)
    expect(Math.abs(model.box.x)).toBeLessThan(BOX_LENGTH / 2)
    advance(120)
    for (let i = 0; i < 23; i++) {
      model.pull(i % 2 === 0)
      advance(185)
    }
    expect(draws).toHaveLength(24)
    expect(model.offcuts).toHaveLength(7)
    for (const row of [...model.rows, ...model.offcuts.flatMap((offcut) => offcut.rows)]) {
      for (const { position } of row.points) {
        expect(position.toArray().every(Number.isFinite)).toBe(true)
        expect(position.y).toBeGreaterThanOrEqual(FLOOR)
      }
    }
  })
})
