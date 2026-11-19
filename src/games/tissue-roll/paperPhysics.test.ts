import { describe, expect, it } from 'vitest'
import { Box3, Ray, Triangle, Vector3 } from 'three'
import { BOX_DEPTH, BOX_HEIGHT, BOX_LENGTH, COLUMNS, FLOOR, PITCH, PaperPhysics, SHEET_ROWS, type PaperRow } from './paperPhysics'

function setup() {
  const draws: number[] = []
  const model = new PaperPhysics({ draw: (strength) => draws.push(strength) })
  const advance = (steps: number) => { for (let i = 0; i < steps; i++) model.step(1 / 120) }
  return { model, draws, advance }
}

function triangles(rows: PaperRow[]) {
  return rows.slice(1).flatMap(({ points }, r) => points.slice(1).flatMap(({ position }, c) => {
    const a = rows[r].points[c].position
    const b = points[c].position
    const d = rows[r].points[c + 1].position
    return [new Triangle(a, b, d), new Triangle(d, b, position)]
  }))
}

function crosses(edges: Triangle[], faces: Triangle[]) {
  const ray = new Ray()
  const hit = new Vector3()
  return edges.some(({ a, b, c }) => [[a, b], [b, c], [c, a]].some(([start, end]) => {
    const length = ray.direction.subVectors(end, start).length()
    if (length < 0.0008) return false
    ray.origin.copy(start)
    ray.direction.divideScalar(length)
    return faces.some((face) => {
      if (!ray.intersectTriangle(face.a, face.b, face.c, false, hit)) return false
      const distance = hit.distanceToSquared(start)
      return distance > 0.0004 ** 2 && distance < (length - 0.0004) ** 2
    })
  }))
}

describe('boxed tissue interaction', () => {
  it('keeps the held and anchored meshes from crossing during repeated presses into the slot', () => {
    const { model, advance } = setup()
    model.pull(true)
    advance(580)
    const [piece] = model.offcuts
    const tip = model.rows.at(-1)!.points[7].position.clone()
    for (let r = 0; r < piece.rows.length; r++) for (let c = 0; c < COLUMNS; c++) {
      const point = piece.rows[r].points[c]
      point.position.set(tip.x + (c - 7) * 0.125, tip.y + 0.17, tip.z - 0.75 + r * PITCH)
      point.previous.copy(point.position)
    }
    const origin = piece.rows[0].points[7].position.clone()
    const target = new Vector3()
    expect(model.grab(0, 7, origin, piece)).toBe(true)
    let crossingFrames = 0
    for (let frame = 0; frame < 120; frame++) {
      const phase = frame * 0.19
      const press = 0.5 - 0.5 * Math.cos(phase)
      model.move(target.set(origin.x + Math.sin(phase * 0.3) * 0.12, origin.y - 0.37 * press, origin.z + 0.525 * press))
      advance(1)
      if (frame % 3 !== 0) continue
      const box = triangles(model.rows)
      const held = triangles(piece.rows)
      if (crosses(box, held) || crosses(held, box)) crossingFrames++
    }
    expect(crossingFrames).toBe(0)
  }, 12_000)

  it('keeps an extended half-sheet stable when the hand stops moving', () => {
    const { model, draws, advance } = setup()
    const row = model.rows.length - 1
    const origin = model.rows[row].points[7].position.clone()
    expect(model.grab(row, 7, origin)).toBe(true)
    model.move(origin.add(new Vector3(0.12, 0.45, 0)))
    advance(50)
    let largestStep = 0
    for (let frame = 0; frame < 125; frame++) {
      const before = new Map(model.rows.flatMap(({ points }) => points.map((point) => [point, point.position.clone()] as const)))
      advance(1)
      for (const { points } of model.rows) for (const point of points) {
        const prior = before.get(point)
        if (prior) largestStep = Math.max(largestStep, prior.distanceTo(point.position))
      }
    }
    expect(model.rows.length).toBeGreaterThan(8)
    expect(draws).toHaveLength(0)
    expect(largestStep).toBeLessThan(0.067)
  })

  it.each([
    { lift: 0.10, pullsPaper: false },
    { lift: 1.0, pullsPaper: true },
  ])('only feeds the box when a held sheet snags and transfers a sustained pull ($lift)', ({ lift, pullsPaper }) => {
    const { model, advance } = setup()
    model.pull(true)
    advance(580)
    const [piece] = model.offcuts
    const tip = model.rows.at(-1)!.points[7].position
    const boxPaper = tip.clone()
    for (let r = 0; r < piece.rows.length; r++) for (let c = 0; c < COLUMNS; c++) {
      const point = piece.rows[r].points[c]
      point.position.set(boxPaper.x + (c - 7) * 0.125, boxPaper.y - 0.08, boxPaper.z - 1.10 + r * PITCH)
      point.previous.copy(point.position)
    }
    const start = piece.rows[0].points[7].position.clone()
    const path = new Vector3(0, lift, 0.825)
    const target = new Vector3()
    const produced = model.produced
    expect(model.grab(0, 7, start, piece)).toBe(true)
    let movement = 0
    for (let frame = 0; frame < 105; frame++) {
      const distance = Math.min(1, frame / 65)
      model.move(target.copy(start).addScaledVector(path, distance))
      advance(1)
      movement = Math.max(movement, tip.distanceTo(boxPaper))
    }
    expect(movement).toBeGreaterThan(0.02)
    if (pullsPaper) expect(model.produced - produced).toBeGreaterThan(0.20)
    else expect(model.produced).toBeCloseTo(produced, 5)
    expect(model.grip?.piece).toBe(piece)
  }, 12_000)

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
    const tip = model.rows.at(-1)!.points[column].position
    expect(tip.y - model.box.lift - (FLOOR + BOX_HEIGHT)).toBeGreaterThan(0.31)
    expect(model.grab(model.rows.length - 1, column, model.rows.at(-1)!.points[column].position)).toBe(true)
  })

  it('lifts the paper with its box and rebounds from the side before landing', () => {
    const { model, draws, advance } = setup()
    model.boxMotion.setBounds({ x: 0.72, lift: 1.45 })
    const top = FLOOR + BOX_HEIGHT
    const hit = new Vector3(0, top - 0.25, 0.57)
    model.boxMotion.grab(hit, 0)
    model.boxMotion.move(hit.clone().add(new Vector3(0.28, 0.72, 0)), 65)
    advance(20)
    expect(model.box.lift).toBeGreaterThan(0.6)
    expect(model.rows[0].points[7].position.y).toBeCloseTo(top + model.box.lift, 1)
    model.boxMotion.move(hit.clone().add(new Vector3(0.68, 0.88, 0)), 90)
    model.boxMotion.release(true, 95)
    const reached = []
    for (let i = 0; i < 380; i++) {
      advance(1)
      reached.push(model.box.x)
    }
    expect(Math.max(...reached)).toBeCloseTo(0.72, 4)
    expect(model.box.x).toBeLessThan(0.6)
    expect(model.box.lift).toBe(0)
    expect(model.boxMotion.moving).toBe(false)
    expect(draws).toEqual([])
    model.pull(true)
    advance(185)
    expect(draws).toHaveLength(1)
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

  it('wakes a settled sheet for another grab, retains its folds, and releases it without feeding new paper', () => {
    const { model, draws, advance } = setup()
    model.pull(true)
    advance(590)
    const [piece] = model.offcuts
    expect(piece.awake).toBe(0)
    const point = piece.rows.at(-1)!.points[6]
    const origin = point.position.clone()
    const target = origin.clone().add(new Vector3(0, 1.15, 0.75))
    const produced = model.produced
    expect(model.grab(piece.rows.length - 1, 6, origin, piece)).toBe(true)
    model.move(target)
    advance(100)
    expect(point.position.distanceTo(target)).toBeLessThan(0.18)
    model.release()
    advance(320)
    expect(point.position.y).toBeLessThan(target.y - 0.35)
    expect(piece.awake).toBe(0)
    expect(point.position.equals(point.previous)).toBe(true)
    const foldedSpans = piece.rows.slice(2).flatMap(({ points }, row) =>
      points.map(({ position }, column) => {
        const a = piece.rows[row].points[column].position
        const b = piece.rows[row + 1].points[column].position
        return a.distanceTo(position) / (a.distanceTo(b) + b.distanceTo(position))
      }),
    )
    expect(foldedSpans.filter((ratio) => ratio < 0.92).length).toBeGreaterThan(15)
    expect(model.produced).toBeCloseTo(produced, 5)
    expect(draws).toHaveLength(1)
  }, 15_000)

  it('transmits an angled pull to the box and keeps repeated draws stable', () => {
    const { model, draws, advance } = setup()
    model.pull(true)
    advance(65)
    expect(Math.abs(model.box.x)).toBeGreaterThan(0.045)
    expect(Math.abs(model.box.x)).toBeLessThan(BOX_LENGTH / 2)
    advance(120)
    for (let i = 0; i < 8; i++) {
      model.pull(i % 2 === 0)
      advance(185)
    }
    expect(draws).toHaveLength(9)
    expect(model.offcuts).toHaveLength(7)
    for (const row of [...model.rows, ...model.offcuts.flatMap((offcut) => offcut.rows)]) {
      for (const { position } of row.points) {
        expect(position.toArray().every(Number.isFinite)).toBe(true)
        expect(position.y).toBeGreaterThanOrEqual(FLOOR)
      }
    }
  }, 20_000)

  it('keeps the carton out of both settled paper vertices and faces during repeated throws', () => {
    const { model, draws, advance } = setup()
    for (let repeat = 0; repeat < 4; repeat++) {
      model.pull(repeat % 2 === 0)
      advance(185)
    }
    expect(draws).toHaveLength(4)
    for (let i = 0; i < 8 && model.offcuts.some((piece) => piece.awake > 0); i++) advance(120)
    expect(model.offcuts.every((piece) => piece.awake === 0)).toBe(true)
    const resting = model.offcuts.map((piece) => piece.rows[0].points[0].position.clone())
    const interior = new Box3(
      new Vector3(-BOX_LENGTH / 2 + 0.004, FLOOR + 0.006, -BOX_DEPTH / 2 + 0.004),
      new Vector3(BOX_LENGTH / 2 - 0.004, FLOOR + BOX_HEIGHT - 0.004, BOX_DEPTH / 2 - 0.004),
    )
    const triangle = new Triangle()
    const local = (point: Vector3, out: Vector3) => {
      const { x, z, yaw, lift } = model.box
      const dx = point.x - x
      const dz = point.z - z
      const cos = Math.cos(yaw)
      const sin = Math.sin(yaw)
      out.set(dx * cos - dz * sin, point.y - lift, dx * sin + dz * cos)
    }
    let intersections = 0
    function check(a: Vector3, b: Vector3, c: Vector3) {
      local(a, triangle.a)
      local(b, triangle.b)
      local(c, triangle.c)
      if (interior.intersectsTriangle(triangle)) intersections++
    }
    for (let toss = 0; toss < 3; toss++) {
      model.boxMotion.toss()
      for (let step = 0; step < 320; step++) {
        advance(1)
        for (const piece of [model, ...model.offcuts]) for (let r = 1; r < piece.rows.length; r++) {
          const above = piece.rows[r - 1].points
          const below = piece.rows[r].points
          for (let c = 1; c < above.length; c++) {
            check(above[c - 1].position, below[c - 1].position, above[c].position)
            check(above[c].position, below[c - 1].position, below[c].position)
          }
        }
      }
    }
    expect(intersections).toBe(0)
    expect(model.offcuts).toHaveLength(4)
    expect(model.offcuts.some((piece, index) => piece.rows[0].points[0].position.distanceTo(resting[index]) > 0.05)).toBe(true)
  }, 25_000)
})
