import { describe, expect, it } from 'vitest'
import { decode, freshState, intent, JOBS, legacyCost, reducer, stats, type Action, type Job, type State } from './model'

function start(job: Job = 'warden', seed = 42): State { return reducer(freshState(), { type: 'start', job, seed }) }
function battle(): State { return reducer(start(), { type: 'room', index: 0 }) }

describe('Ashbound combat and progression', () => {
  it('creates distinct jobs and deterministic two-way routes without mutating input', () => {
    const initial = freshState(), a = reducer(initial, { type: 'start', job: 'witch', seed: 47 })
    expect(initial.run).toBeNull()
    expect(a).toEqual(start('witch', 47))
    expect(a.run!.skills).toEqual(JOBS.witch.skills)
    expect(new Set(a.run!.paths).size).toBe(2)
    expect(a.run!.hp).toBe(82)
    expect(reducer(a, { type: 'start', job: 'reaper', seed: 1 })).toBe(a)
  })
  it('advances a single enemy turn for a valid action and rejects cooling skills', () => {
    const before = battle(), after = reducer(before, { type: 'skill', index: 1 })
    expect(before.run!.enemy!.turn).toBe(0)
    expect(after.run!.enemy!.turn).toBe(1)
    expect(after.run!.cooldowns[1]).toBe(2)
    expect(reducer(after, { type: 'skill', index: 1 })).toBe(after)
    expect(reducer(after, { type: 'skill', index: -1 })).toBe(after)
  })
  it('guards against telegraphed heavy attacks and heals within the health cap', () => {
    const state = battle()
    state.run!.enemy!.hp = state.run!.enemy!.maxHp = 1000
    state.run!.enemy!.turn = 2
    state.run!.hp = 50
    const normal = reducer(state, { type: 'skill', index: 0 })
    const guarded = reducer(state, { type: 'skill', index: 2 })
    expect(intent(state.run!.enemy!).name).toBe('蓄力重擊')
    expect(guarded.run!.hp).toBeGreaterThan(normal.run!.hp + 10)
    const healed = reducer(battle(), { type: 'skill', index: 3 })
    expect(healed.run!.hp).toBeLessThanOrEqual(stats(healed).maxHp)
  })
  it('applies poison before retaliation and does not allow a defeated enemy to hit', () => {
    const state = battle(); state.run!.enemy!.hp = 12
    const won = reducer(state, { type: 'skill', index: 4 })
    expect(won.run!.phase).toBe('loot')
    expect(won.run!.hp).toBe(state.run!.hp)
    expect(won.run!.kills).toBe(1)
    expect(reducer(won, { type: 'skill', index: 0 })).toBe(won)
  })
  it('replaces gear in the same slot, clamps health, and resolves rewards once', () => {
    const state = start()
    state.run!.phase = 'loot'
    state.run!.loot = { name: '新護甲', slot: 'armor', vitality: 5, defense: 2, power: 0, leech: 0 }
    state.run!.gear = [{ name: '舊護甲', slot: 'armor', vitality: 50, defense: 1, power: 0, leech: 0 }]
    state.run!.hp = 155
    const result = reducer(state, { type: 'loot', equip: true })
    expect(result.run!.gear).toHaveLength(1)
    expect(result.run!.hp).toBe(110)
    expect(result.run!.room).toBe(1)
    expect(reducer(result, { type: 'loot', equip: true })).toBe(result)
  })
  it('preserves the fallback strike and supports skill replacement after loot', () => {
    const state = start(); state.run!.phase = 'loot'; state.run!.offeredSkill = 'fire'
    expect(reducer(state, { type: 'learn', index: 0 })).toBe(state)
    const next = reducer(state, { type: 'learn', index: 1 })
    expect(next.run!.skills).toEqual(['strike', 'fire', 'guard', 'mend', 'venom'])
    expect(next.run!.phase).toBe('path')
  })
  it('recovers at camps, bargains at shrines, and forces floor-five boss', () => {
    const state = start(); state.run!.hp = 20; state.run!.cooldowns = [0, 2, 2, 4, 3]; state.run!.paths = ['rest', 'shrine']
    const rest = reducer(state, { type: 'room', index: 0 })
    expect(rest.run!.hp).toBe(62)
    expect(rest.run!.cooldowns).toEqual([0, 0, 0, 0, 0])
    const shrine = reducer(reducer(state, { type: 'room', index: 1 }), { type: 'shrine', accept: true })
    expect(shrine.run!.hp).toBe(16)
    expect(shrine.run!.level).toBe(2)
    state.run!.floor = 5; state.run!.room = 1
    const bossPath = reducer(state, { type: 'room', index: 0 })
    expect(bossPath.run!.paths).toEqual(['boss'])
    const boss = reducer(bossPath, { type: 'room', index: 0 })
    expect(boss.run!.enemy!.name).toBe('守鐘巨骸')
  })
  it('settles death once and purchases bounded permanent upgrades', () => {
    const state = battle(); state.run!.hp = 1; state.run!.kills = 7
    const dead = reducer(state, { type: 'skill', index: 0 })
    expect(dead.run!.phase).toBe('dead'); expect(dead.souls).toBe(15); expect(dead.runs).toBe(1)
    expect(reducer(dead, { type: 'retire' })).toBe(dead)
    const camp = reducer(dead, { type: 'camp' }), upgraded = reducer(camp, { type: 'upgrade' })
    expect(upgraded.souls).toBe(camp.souls - legacyCost(camp)); expect(upgraded.legacy).toBe(1)
    expect(reducer(upgraded, { type: 'upgrade' })).toBe(upgraded)
    const next = reducer(upgraded, { type: 'start', job: 'warden', seed: 1 })
    expect(stats(next).maxHp).toBe(110); expect(stats(next).power).toBe(14)
  })
  it('finishes after the final boss, awards victory once, and permits replay', () => {
    const state = battle(); state.run!.floor = 10; state.run!.room = 2; state.run!.enemy!.kind = 3; state.run!.enemy!.hp = 1
    const won = reducer(state, { type: 'skill', index: 0 })
    expect(won.run!.phase).toBe('won'); expect(won.souls).toBe(37); expect(won.wins).toBe(1)
    expect(reducer(won, { type: 'continue' })).toBe(won)
    const replay = reducer(reducer(won, { type: 'camp' }), { type: 'start', job: 'witch', seed: 9 })
    expect(replay.run!.floor).toBe(1); expect(replay.wins).toBe(1)
  })
})

// Deterministic player uses visible information only: no seed peeking or state edits.
function choose(state: State): Action {
  const r = state.run!, attr = stats(state)
  if (r.phase === 'path') {
    const scores: number[] = r.paths.map(room => room === 'rest' ? (r.hp < attr.maxHp * .7 ? 8 : 0) : room === 'shrine' ? 6 : room === 'battle' ? 5 : room === 'treasure' ? 4 : 1)
    return { type: 'room', index: scores.indexOf(Math.max(...scores)) }
  }
  if (r.phase === 'shrine') return { type: 'shrine', accept: true }
  if (r.phase === 'loot') {
    if (!r.loot) return { type: 'continue' }
    const old = r.gear.find(g => g.slot === r.loot!.slot)
    const value = (g: NonNullable<typeof old>) => g.power * 3 + g.vitality + g.defense * 4 + g.leech * 5
    return { type: 'loot', equip: !old || value(r.loot) > value(old) }
  }
  const scores: number[] = r.skills.map((id, i) => {
    if (r.cooldowns[i]) return -100
    if (id === 'mend') return r.hp < attr.maxHp * .55 ? 150 : -1
    if (id === 'guard') return intent(r.enemy!).name === '蓄力重擊' ? 120 : -1
    if (id === 'drain') return r.hp < attr.maxHp * .8 ? 100 : 35
    if (id === 'execute') return r.enemy!.hp < r.enemy!.maxHp / 2 ? 90 : 40
    return id === 'fire' ? 80 : id === 'cleave' ? 70 : id === 'venom' ? (r.enemy!.hp > attr.power * 2 ? 85 : 5) : 10
  })
  return { type: 'skill', index: scores.indexOf(Math.max(...scores)) }
}

describe('Ashbound saves and complete expeditions', () => {
  it('rejects corrupt JSON, unknown IDs, missing fields and incoherent battle state', () => {
    for (const raw of ['nope', '{}', 'null', JSON.stringify({ ...freshState(), legacy: -1 }), JSON.stringify({ ...start(), run: {} })]) expect(decode(raw)).toEqual(freshState())
    const invalid = battle(); invalid.run!.enemy = null
    expect(decode(JSON.stringify(invalid))).toEqual(freshState())
    const badSkill = JSON.parse(JSON.stringify(start())); badSkill.run.skills[0] = 'toString'
    expect(decode(JSON.stringify(badSkill))).toEqual(freshState())
    expect(decode(JSON.stringify(battle()))).toEqual(battle())
  })
  it.each(['warden', 'witch', 'reaper'] as const)('%s can complete an unboosted run and every transition survives reload', job => {
    let wins = 0
    for (let seed = 1; seed <= 20; seed++) {
      let state = start(job, seed), steps = 0
      while (!['won', 'dead'].includes(state.run!.phase) && steps++ < 600) {
        const next = reducer(state, choose(state))
        expect(next).not.toBe(state)
        expect(decode(JSON.stringify(next))).toEqual(next)
        state = next
      }
      expect(steps).toBeLessThan(600)
      if (state.run!.phase === 'won') wins++
    }
    expect(wins, `${job} victories out of 20`).toBeGreaterThanOrEqual(2)
  })
})
