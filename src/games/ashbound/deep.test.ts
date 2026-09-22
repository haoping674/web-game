import { describe, expect, it } from 'vitest'
import { decode, depthPressure, encounterTrait, freshState, incomingDamage, intent, poisonPerStack, reducer, stats, type Job, type State } from './model'
import { simulate } from '../../../scripts/lib/ashbound-simulation'

function encounter(floor = 11, job: Job = 'warden'): State {
  const state = reducer(freshState(), { type: 'start', job, seed: 42 })
  state.run!.floor = floor; state.run!.paths = ['battle']
  return reducer(state, { type: 'room', index: 0 })
}

describe('deep encounters and counterplay', () => {
  it('preserves the opening floors and gradually increases new encounters', () => {
    expect(depthPressure(10)).toEqual({ healthPercent: 0, attackPercent: 0 })
    expect(encounter(10).run!.enemy).toMatchObject({ maxHp: 170, attack: 27, trait: 'none', enrages: false })
    expect(encounter(11).run!.enemy).toMatchObject({ maxHp: 188, attack: 29, trait: 'piercing', enrages: true })
    expect(encounter(50).run!.enemy!.attack).toBeGreaterThan(encounter(20).run!.enemy!.attack)
    expect([0, 1, 2].map(room => encounterTrait(11, room))).toEqual(['piercing', 'withering', 'armored'])
  })
  it('previews armor-piercing heavy attacks accurately and keeps guard effective', () => {
    const state = encounter(), run = state.run!, enemy = run.enemy!
    run.gear = [{ name: '護甲', slot: 'armor', defense: 20, power: 0, vitality: 0, leech: 0 }]
    run.hp = 80; enemy.kind = 0; enemy.hp = enemy.maxHp = 1000; enemy.attack = 40; enemy.turn = 2
    expect(intent(enemy)).toMatchObject({ damage: 76, armorPierce: .5 })
    expect(incomingDamage(state)).toBe(65); expect(incomingDamage(state, true)).toBe(13)
    const hit = reducer(state, { type: 'skill', index: 0 })
    const guard = reducer(state, { type: 'skill', index: 2 })
    expect(hit.run!.hp).toBe(15)
    expect(guard.run!.hp).toBe(80 + 6 - 13)
    expect(intent({ ...enemy, turn: 1 }).armorPierce).toBe(0)
  })
  it('reduces combat healing under withering but preserves camp and victory recovery', () => {
    const state = encounter(12), run = state.run!, enemy = run.enemy!
    run.hp = 10; enemy.kind = 0; enemy.attack = 1; enemy.hp = enemy.maxHp = 1000
    expect(enemy.trait).toBe('withering')
    expect(reducer(state, { type: 'skill', index: 3 }).run!.hp).toBe(31)
    run.phase = 'path'; run.paths = ['rest']
    expect(reducer(state, { type: 'room', index: 0 }).run!.hp).toBe(52)
    run.phase = 'battle'; run.xp = 2; enemy.hp = 1; enemy.kind = 3; enemy.elite = true
    const unmodified = structuredClone(state); unmodified.run!.enemy!.trait = 'none'
    expect(reducer(state, { type: 'skill', index: 0 }).run!.hp).toBe(reducer(unmodified, { type: 'skill', index: 0 }).run!.hp)
  })
  it('caps deep drain and excludes overkill without disabling the skill', () => {
    const state = encounter(11, 'reaper'), run = state.run!, enemy = run.enemy!
    run.hp = 10; enemy.attack = 1; enemy.kind = 0; enemy.hp = enemy.maxHp = 1000
    run.gear = [{ name: '刻刃', slot: 'weapon', defense: 0, power: 200, vitality: 0, leech: 0 }]
    const drained = reducer(state, { type: 'skill', index: 1 })
    expect(drained.run!.hp).toBe(10 + Math.round(stats(state).maxHp * .15) - 1)
    enemy.hp = 2
    const finished = reducer(state, { type: 'skill', index: 1 })
    expect(finished.run!.hp).toBe(11); expect(finished.run!.phase).toBe('loot')
  })
  it('lets scaling poison bypass bone armor while reducing direct damage', () => {
    const state = encounter(13), run = state.run!, enemy = run.enemy!
    run.gear = [{ name: '刻刃', slot: 'weapon', defense: 0, power: 87, vitality: 0, leech: 0 }]
    enemy.hp = enemy.maxHp = 1000; enemy.attack = 1
    expect(enemy.trait).toBe('armored'); expect(poisonPerStack(state)).toBe(6)
    const result = reducer(state, { type: 'skill', index: 4 })
    expect(result.run!.enemy!.hp).toBe(1000 - 40 - 18)
  })
  it('starts uncapped rage at the advertised turn and resets it for the next encounter', () => {
    const state = encounter(), enemy = state.run!.enemy!
    enemy.turn = 7; expect(intent(enemy).enragePercent).toBe(0)
    enemy.turn = 8; expect(intent(enemy).enragePercent).toBe(15)
    enemy.turn = 9; expect(intent(enemy).enragePercent).toBe(30)
    enemy.turn = 100; expect(intent(enemy).enragePercent).toBeGreaterThan(1000)
    enemy.hp = 1
    let next = reducer(state, { type: 'skill', index: 0 })
    next = reducer(next, { type: 'loot', equip: false })
    if (next.run!.phase === 'loot') next = reducer(next, { type: 'continue' })
    next.run!.paths = ['battle']
    next = reducer(next, { type: 'room', index: 0 })
    expect(next.run!.enemy!.turn).toBe(0); expect(intent(next.run!.enemy!).enragePercent).toBe(0)
    expect(intent({ ...enemy, enrages: false }).enragePercent).toBe(0)
  })
  it('eventually kills a healing loop through rising damage rather than a forced ending', () => {
    let state = encounter(12)
    state.run!.enemy!.trait = 'none'; state.run!.enemy!.kind = 0
    state.run!.enemy!.attack = 4; state.run!.enemy!.hp = state.run!.enemy!.maxHp = 100000
    for (let turn = 0; turn < 200 && state.run!.phase === 'battle'; turn++) {
      const run = state.run!
      const index = run.hp < 80 && !run.cooldowns[3] ? 3 : !run.cooldowns[2] ? 2 : 0
      state = reducer(state, { type: 'skill', index })
    }
    expect(state.run!.phase).toBe('dead'); expect(state.run!.hp).toBe(0)
    expect(state.runs).toBe(1); expect(state.run!.enemy!.hp).toBeGreaterThan(0)
  })
})

describe('deep save compatibility and balance regression', () => {
  it('preserves an old active encounter and enables new rules only in later rooms', () => {
    const original = encounter(40)
    const raw = JSON.parse(JSON.stringify(original))
    delete raw.run.enemy.trait; delete raw.run.enemy.enrages
    const migrated = decode(JSON.stringify(raw))
    expect(migrated.run!.enemy).toMatchObject({ trait: 'none', enrages: false, attack: original.run!.enemy!.attack })
    expect(decode(JSON.stringify(migrated))).toEqual(migrated)
    migrated.run!.enemy!.hp = 1
    let next = reducer(migrated, { type: 'skill', index: 0 })
    next = reducer(next, { type: 'loot', equip: false })
    if (next.run!.phase === 'loot') next = reducer(next, { type: 'continue' })
    next.run!.paths = ['battle']; next = reducer(next, { type: 'room', index: 0 })
    expect(next.run!.enemy!.enrages).toBe(true)
    expect(decode(JSON.stringify(next))).toEqual(next)
  })
  it('round-trips rage and traits, rejects invalid traits, and does not reroll on reload', () => {
    const state = encounter(50); state.run!.enemy!.turn = 15
    expect(decode(JSON.stringify(state))).toEqual(state)
    for (const invalid of [{ trait: 'unknown' }, { enrages: 'true' }, { turn: -1 }]) {
      const raw = JSON.parse(JSON.stringify(state)); Object.assign(raw.run.enemy, invalid)
      expect(decode(JSON.stringify(raw))).toEqual(freshState())
    }
  })
  it.each(['warden', 'witch', 'reaper'] as const)('%s has survivable early depths and real late-game mortality', job => {
    const runs = Array.from({ length: 20 }, (_, index) => simulate(job, index + 1, 0, 'tactical'))
    expect(runs.filter(run => run.floor > 20).length).toBeGreaterThanOrEqual(10)
    expect(runs.filter(run => run.dead).length).toBeGreaterThanOrEqual(10)
    expect(runs.every(run => !run.stalled)).toBe(true)
  })
})
