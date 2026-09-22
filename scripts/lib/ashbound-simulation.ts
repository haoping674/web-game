import { freshState, reducer, stats, type Action, type Gear, type Job, type State } from '../../src/games/ashbound/model'

export type Strategy = 'tactical' | 'aggressive'
const gearValue = (gear: Gear): number => gear.power * 3 + gear.vitality + gear.defense * 4 + gear.leech * 5

// This player only uses visible state. It does not inspect RNG or modify a run.
// Keep the policy unchanged between baseline and candidate measurements.
export function chooseAction(state: State, strategy: Strategy): Action {
  const run = state.run!, attributes = stats(state)
  if (run.phase === 'path') {
    const scores: number[] = run.paths.map(room => room === 'rest' ? (run.hp < attributes.maxHp * .7 ? 8 : 0)
      : room === 'shrine' ? 6 : room === 'battle' ? 5 : room === 'treasure' ? 4 : 1)
    return { type: 'room', index: scores.indexOf(Math.max(...scores)) }
  }
  if (run.phase === 'shrine') return { type: 'shrine', accept: true }
  if (run.phase === 'loot') {
    if (!run.loot) return { type: 'continue' }
    const old = run.gear.find(gear => gear.slot === run.loot!.slot)
    return { type: 'loot', equip: !old || gearValue(run.loot) > gearValue(old) }
  }
  const enemy = run.enemy!
  const scores: number[] = run.skills.map((id, index) => {
    if (run.cooldowns[index]) return -100
    if (id === 'mend') return run.hp < attributes.maxHp * (strategy === 'tactical' ? .55 : .2) ? 150 : -1
    if (id === 'guard') return strategy === 'tactical' && enemy.turn % 3 === 2 ? 120 : -1
    if (id === 'drain') return run.hp < attributes.maxHp * .8 ? 100 : 35
    if (id === 'execute') return enemy.hp < enemy.maxHp / 2 ? 90 : 40
    return id === 'fire' ? 80 : id === 'cleave' ? 70 : id === 'venom' ? (enemy.hp > attributes.power * 2 ? 85 : 5) : 10
  })
  return { type: 'skill', index: scores.indexOf(Math.max(...scores)) }
}

export function simulate(job: Job, seed: number, legacy: number, strategy: Strategy, maxFloor = 100): { floor: number; dead: boolean; steps: number; stalled: boolean } {
  let state = reducer({ ...freshState(), legacy }, { type: 'start', job, seed })
  let steps = 0
  while (state.run!.phase !== 'dead' && state.run!.floor <= maxFloor && steps < 20000) {
    const next = reducer(state, chooseAction(state, strategy))
    if (next === state) throw new Error(`No progress for ${job}, seed ${seed}, phase ${state.run!.phase}`)
    state = next; steps++
  }
  return { floor: state.run!.floor, dead: state.run!.phase === 'dead', steps, stalled: steps >= 20000 }
}
