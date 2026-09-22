export type Job = 'warden' | 'witch' | 'reaper'
export type SkillId = 'strike' | 'cleave' | 'guard' | 'mend' | 'venom' | 'fire' | 'drain' | 'execute'
export type Room = 'battle' | 'elite' | 'rest' | 'shrine' | 'treasure' | 'boss'
export type Slot = 'weapon' | 'armor' | 'charm'
export type Gear = { name: string; slot: Slot; power: number; vitality: number; defense: number; leech: number }
export type EnemyTrait = 'none' | 'piercing' | 'withering' | 'armored'
export type Enemy = { name: string; kind: number; hp: number; maxHp: number; attack: number; turn: number; poison: number; elite: boolean; trait: EnemyTrait; enrages: boolean }
export type Run = {
  job: Job; floor: number; room: number; level: number; xp: number; hp: number; kills: number; crowns: number;
  skills: SkillId[]; cooldowns: number[]; gear: Gear[]; enemy: Enemy | null;
  phase: 'path' | 'battle' | 'loot' | 'shrine' | 'dead' | 'won'; paths: Room[];
  loot: Gear | null; offeredSkill: SkillId | null; log: string[]; ward: number;
}
export type State = { version: 1; seed: number; souls: number; legacy: number; best: number; runs: number; wins: number; run: Run | null }
export type Action =
  | { type: 'start'; job: Job; seed: number }
  | { type: 'room'; index: number }
  | { type: 'skill'; index: number }
  | { type: 'loot'; equip: boolean }
  | { type: 'learn'; index: number }
  | { type: 'shrine'; accept: boolean }
  | { type: 'continue' } | { type: 'retire' } | { type: 'camp' } | { type: 'upgrade' }

export const JOBS: Record<Job, { name: string; title: string; description: string; hp: number; power: number; skills: SkillId[] }> = {
  warden: { name: '守墓人', title: 'THE WARDEN', description: '厚甲與重斬。用防禦抵擋蓄力攻擊，再伺機反擊。', hp: 105, power: 13, skills: ['strike', 'cleave', 'guard', 'mend', 'venom'] },
  witch: { name: '燼火巫', title: 'THE WITCH', description: '烈焰與疫毒。疊加毒素，讓每一次等待都成為傷害。', hp: 82, power: 16, skills: ['strike', 'fire', 'venom', 'mend', 'guard'] },
  reaper: { name: '渡魂者', title: 'THE REAPER', description: '汲取與斬殺。從敵人的生命中，找回自己的生機。', hp: 92, power: 14, skills: ['strike', 'drain', 'execute', 'guard', 'mend'] },
}
export const SKILLS: Record<SkillId, { name: string; icon: string; cooldown: number; description: string }> = {
  strike: { name: '斬擊', icon: '†', cooldown: 0, description: '造成 100% 攻擊傷害。隨時可用。' },
  cleave: { name: '破墓重斬', icon: '⚔', cooldown: 2, description: '造成 210% 攻擊傷害。' },
  guard: { name: '守夜', icon: '◇', cooldown: 2, description: '本回合減傷 80%，回復 6% 最大生命。' },
  mend: { name: '餘燼癒合', icon: '✦', cooldown: 4, description: '回復 30% 最大生命，仍會受到敵人攻擊。' },
  venom: { name: '腐朽之種', icon: '❋', cooldown: 3, description: '造成 50% 傷害，疊加 3 層毒；每層每回合傷害 3。' },
  fire: { name: '焚骨', icon: '♨', cooldown: 3, description: '造成 260% 攻擊傷害。' },
  drain: { name: '渡魂', icon: '☽', cooldown: 3, description: '造成 130% 傷害，回復傷害量 70% 的生命。' },
  execute: { name: '終焉', icon: '‡', cooldown: 3, description: '造成 150% 傷害；敵人生命低於一半時為 300%。' },
}
export const ROOMS: Record<Room, { name: string; icon: string; description: string }> = {
  battle: { name: '亡者迴廊', icon: '†', description: '一般敵人 · 裝備與經驗' },
  elite: { name: '血色獵場', icon: '⚔', description: '強敵 · 更高品質裝備、雙倍經驗' },
  rest: { name: '餘火營地', icon: '♨', description: '回復 40% 生命 · 重置冷卻' },
  shrine: { name: '無名祭壇', icon: '◇', description: '獻出 20% 當前生命，換取力量' },
  treasure: { name: '遺忘棺室', icon: '▱', description: '無須戰鬥 · 發現隨機裝備' },
  boss: { name: '封印之門', icon: '♜', description: '必經首領 · 勝利後恢復生命' },
}
export const SLOT_NAMES: Record<Slot, string> = { weapon: '武器', armor: '護甲', charm: '遺物' }
export const ENEMY_TRAITS: Record<EnemyTrait, { name: string; description: string }> = {
  none: { name: '無特性', description: '' },
  piercing: { name: '破甲', description: '蓄力重擊忽略 50% 護甲；守夜仍可減傷 80%。' },
  withering: { name: '枯萎', description: '交戰時技能與命中回血減少 30%；營地、升級與戰後回復不受影響。' },
  armored: { name: '骨鎧', description: '直接傷害減少 20%；腐朽的毒素傷害不受影響。' },
}
export function depthPressure(floor: number): { healthPercent: number; attackPercent: number } {
  const depth = Math.max(0, floor - 10)
  return { healthPercent: depth * 2, attackPercent: Math.round(depth * 1.2) }
}
export function encounterTrait(floor: number, room: number): EnemyTrait {
  return floor <= 10 ? 'none' : (['piercing', 'withering', 'armored'] as const)[(floor - 11 + room) % 3]
}
export const ENRAGE_START_TURN = 9
export function poisonPerStack(state: State): number {
  const run = state.run
  const deep = run?.enemy ? run.enemy.enrages : (run?.floor ?? 1) > 10
  return deep ? Math.max(3, Math.floor(stats(state).power * .06)) : 3
}
export const SAVE_KEY = 'orchard-ashbound-v1'
export const freshState = (): State => ({ version: 1, seed: 1, souls: 0, legacy: 0, best: 0, runs: 0, wins: 0, run: null })
export const legacyCost = (state: State): number => (state.legacy + 1) * 12
export const soulReward = (run: Run): number => run.kills * 2 + run.floor + run.crowns * 25
export function stats(state: State): { maxHp: number; power: number; defense: number; leech: number } {
  const run = state.run!
  return {
    maxHp: JOBS[run.job].hp + state.legacy * 5 + (run.level - 1) * 9 + run.gear.reduce((n, g) => n + g.vitality, 0),
    power: JOBS[run.job].power + state.legacy + (run.level - 1) * 3 + run.gear.reduce((n, g) => n + g.power, 0),
    defense: (run.job === 'warden' ? 3 : 1) + run.gear.reduce((n, g) => n + g.defense, 0),
    leech: run.gear.reduce((n, g) => n + g.leech, 0),
  }
}
function roll(state: State, size: number): number {
  state.seed = (Math.imul(state.seed, 1664525) + 1013904223) >>> 0
  return Math.floor((state.seed / 4294967296) * size)
}
function log(run: Run, message: string): void { run.log = [message, ...run.log].slice(0, 7) }
function heal(state: State, amount: number, inCombat = false): void {
  const multiplier = inCombat && state.run!.enemy?.trait === 'withering' ? .7 : 1
  state.run!.hp = Math.min(stats(state).maxHp, state.run!.hp + Math.round(amount * multiplier))
}
function paths(state: State): void {
  const run = state.run!
  run.phase = 'path'; run.enemy = null; run.loot = null; run.offeredSkill = null
  if (run.room === 2 && run.floor % 5 === 0) { run.paths = ['boss']; return }
  const options: Room[] = ['battle', 'elite', 'rest', 'shrine', 'treasure']
  const first = roll(state, options.length)
  run.paths = [options[first], options[(first + 1 + roll(state, options.length - 1)) % options.length]]
  // Every floor begins with a combat option, keeping XP available without forcing all fights.
  if (run.room === 0) run.paths[0] = 'battle'
  if (run.paths[0] === run.paths[1]) run.paths[1] = 'rest'
}
function advance(state: State): void {
  const run = state.run!
  run.room++
  if (run.room === 3) { run.floor++; run.room = 0; log(run, `踏入第 ${run.floor} 層。更深處仍有呼吸聲。`) }
  state.best = Math.max(state.best, run.floor)
  paths(state)
}
function gear(state: State, elite: boolean): Gear {
  const tier = state.run!.floor + (elite ? 2 : 0)
  const slot = (['weapon', 'armor', 'charm'] as const)[roll(state, 3)]
  const prefix = ['灰燼', '月蝕', '荊棘', '亡語'][roll(state, 4)]
  return { name: `${prefix}${slot === 'weapon' ? '刻刃' : slot === 'armor' ? '裹衣' : '骨符'} +${tier}`, slot,
    power: slot === 'weapon' ? 3 + tier * 2 : slot === 'charm' ? tier : 0,
    vitality: slot === 'armor' ? 8 + tier * 4 : 0,
    defense: slot === 'armor' ? 1 + Math.floor(tier / 2) : 0,
    leech: slot === 'charm' ? 1 + Math.floor(tier / 3) : 0 }
}
function reward(state: State, elite: boolean): void {
  const run = state.run!
  run.phase = 'loot'; run.loot = gear(state, elite)
  run.offeredSkill = roll(state, 2) === 0 ? (Object.keys(SKILLS) as SkillId[])[1 + roll(state, 7)] : null
  if (run.offeredSkill && run.skills.includes(run.offeredSkill)) run.offeredSkill = null
}
function finish(state: State): void {
  const run = state.run!
  run.phase = 'dead'; run.hp = 0
  const reward = soulReward(run)
  state.souls += reward; state.best = Math.max(state.best, run.floor); state.runs++
  log(run, `名字已刻入墓誌。留下 ${reward} 魂燼。`)
}
export function intent(enemy: Enemy): { name: string; damage: number; poison: boolean; armorPierce: number; enragePercent: number } {
  const charged = enemy.turn % 3 === 2
  const enragePercent = enemy.enrages ? Math.max(0, enemy.turn + 2 - ENRAGE_START_TURN) * 15 : 0
  return { name: charged ? '蓄力重擊' : enemy.kind === 2 ? '腐蝕爪擊' : '攻擊',
    damage: Math.round(enemy.attack * (charged ? 1.9 : 1) * (1 + enragePercent / 100)),
    poison: enemy.kind === 2 && !charged, armorPierce: charged && enemy.trait === 'piercing' ? .5 : 0, enragePercent }
}
export function incomingDamage(state: State, blocking = false): number {
  const run = state.run!
  if (!run.enemy) return 0
  const attack = intent(run.enemy)
  const defense = Math.floor(stats(state).defense * (1 - attack.armorPierce))
  return Math.max(1, Math.round((Math.max(1, attack.damage - defense) + run.ward) * (blocking ? .2 : 1)))
}
export function reducer(current: State, action: Action): State {
  if (action.type === 'start') {
    if (current.run && !['dead', 'won'].includes(current.run.phase)) return current
    const state: State = { ...current, seed: action.seed >>> 0, run: {
      job: action.job, floor: 1, room: 0, level: 1, xp: 0, hp: JOBS[action.job].hp + current.legacy * 5,
      kills: 0, crowns: 0, skills: [...JOBS[action.job].skills], cooldowns: [0, 0, 0, 0, 0], gear: [], enemy: null,
      phase: 'path', paths: [], loot: null, offeredSkill: null, log: ['你在沒有名字的墓前醒來。'], ward: 0,
    } }
    paths(state); return state
  }
  if (action.type === 'upgrade') {
    if (current.run || current.legacy >= 5 || current.souls < legacyCost(current)) return current
    return { ...current, souls: current.souls - legacyCost(current), legacy: current.legacy + 1 }
  }
  if (!current.run) return current
  const state = structuredClone(current), run = state.run!
  if (action.type === 'camp') return ['dead', 'won'].includes(run.phase) ? { ...state, run: null } : current
  if (['dead', 'won'].includes(run.phase)) return current
  if (action.type === 'retire') { finish(state); return state }
  if (action.type === 'room' && run.phase === 'path') {
    const room = run.paths[action.index]
    if (!room) return current
    state.best = Math.max(state.best, run.floor)
    if (room === 'rest') {
      heal(state, stats(state).maxHp * .4); run.cooldowns.fill(0); run.ward = 0
      log(run, '餘火修補傷口：回復 40% 生命，所有技能冷卻歸零。'); advance(state)
    } else if (room === 'shrine') run.phase = 'shrine'
    else if (room === 'treasure') { log(run, '棺蓋之下，有人留下了旅途的餘物。'); reward(state, false) }
    else {
      const boss = room === 'boss', elite = room === 'elite' || boss
      const kind = boss ? 3 : roll(state, 3)
      const pressure = depthPressure(run.floor)
      const maxHp = Math.round((30 + run.floor * 14) * (boss ? 2.2 : elite ? 1.5 : 1) * (1 + pressure.healthPercent / 100))
      run.enemy = { name: boss ? (run.floor % 10 === 0 ? '無晝之王' : '守鐘巨骸') : ['提燈亡者', '荊棘騎士', '疫骨獵犬'][kind], kind, hp: maxHp, maxHp,
        attack: Math.round((7 + run.floor * 2) * (elite ? 1.3 : 1) * (1 + pressure.attackPercent / 100)),
        turn: 0, poison: 0, elite, trait: encounterTrait(run.floor, run.room), enrages: run.floor > 10 }
      run.phase = 'battle'; run.ward = 0; log(run, `${run.enemy.name} 擋住了去路。`)
    }
    return state
  }
  if (action.type === 'skill' && run.phase === 'battle' && run.enemy) {
    const id = run.skills[action.index]
    if (!id || run.cooldowns[action.index] > 0) return current
    const enemy = run.enemy, attributes = stats(state)
    run.cooldowns = run.cooldowns.map(n => Math.max(0, n - 1))
    run.cooldowns[action.index] = SKILLS[id].cooldown
    let damage = 0, blocking = false
    if (id === 'guard') { blocking = true; heal(state, attributes.maxHp * .06, true) }
    else if (id === 'mend') { heal(state, attributes.maxHp * .3, true); run.ward = 0 }
    else {
      const factor = id === 'cleave' ? 2.1 : id === 'fire' ? 2.6 : id === 'venom' ? .5 : id === 'drain' ? 1.3 : id === 'execute' ? (enemy.hp < enemy.maxHp / 2 ? 3 : 1.5) : 1
      damage = Math.round(attributes.power * factor * (enemy.trait === 'armored' ? .8 : 1))
      const actualDamage = Math.min(enemy.hp, damage)
      enemy.hp = Math.max(0, enemy.hp - damage)
      if (id === 'venom') enemy.poison += 3
      const drained = id === 'drain' ? (enemy.enrages ? Math.min(actualDamage * .7, attributes.maxHp * .15) : damage * .7) : 0
      heal(state, attributes.leech + drained, true)
    }
    log(run, `你使用${SKILLS[id].name}${damage ? `，造成 ${damage} 傷害` : '，回復生命'}。`)
    if (enemy.hp > 0 && enemy.poison) {
      const poisonDamage = enemy.poison * poisonPerStack(state)
      enemy.hp = Math.max(0, enemy.hp - poisonDamage); log(run, `腐朽侵蝕敵人：${poisonDamage} 傷害。`)
    }
    if (enemy.hp <= 0) {
      run.kills++; run.xp += enemy.elite ? 2 : 1
      if (run.xp >= 3) { run.xp -= 3; run.level++; heal(state, stats(state).maxHp * .3); log(run, `升至 Lv. ${run.level}，攻擊與生命提升，回復 30% 生命。`) }
      log(run, `${enemy.name} 已倒下。`)
      if (enemy.kind === 3 && run.floor % 10 === 0) {
        run.crowns++; state.wins++
        log(run, '無晝之王倒下，深淵仍未見底。結算時額外獲得 25 魂燼。')
      }
      if (enemy.kind === 3) { heal(state, stats(state).maxHp * .5); log(run, '鐘聲止息。首領封印回復了 50% 生命。') }
      run.ward = 0; reward(state, enemy.elite); return state
    }
    const attack = intent(enemy)
    const taken = incomingDamage(state, blocking)
    run.hp = Math.max(0, run.hp - taken)
    log(run, `${enemy.name} 使用${attack.name}，你受到 ${taken} 傷害${blocking ? '（守夜減傷）' : ''}。`)
    if (attack.poison) run.ward = Math.min(6, run.ward + 2)
    enemy.turn++
    if (run.hp <= 0) finish(state)
    return state
  }
  if (action.type === 'shrine' && run.phase === 'shrine') {
    if (action.accept) { run.hp = Math.max(1, Math.ceil(run.hp * .8)); run.level++; log(run, '祭壇接受了鮮血。等級提升 1，力量與生命上限增加。') }
    else log(run, '你拒絕了低語，繼續向前。')
    advance(state); return state
  }
  if (run.phase === 'loot') {
    if (action.type === 'loot' && run.loot) {
      if (action.equip) {
        const oldMax = stats(state).maxHp
        run.gear = [...run.gear.filter(g => g.slot !== run.loot!.slot), run.loot]
        run.hp = Math.min(stats(state).maxHp, run.hp + Math.max(0, stats(state).maxHp - oldMax))
        log(run, `裝備了${run.loot.name}。`)
      }
      run.loot = null
      if (!run.offeredSkill) advance(state)
      return state
    }
    if (action.type === 'learn' && !run.loot && run.offeredSkill && action.index > 0 && action.index < 5) {
      log(run, `以${SKILLS[run.offeredSkill].name}替換${SKILLS[run.skills[action.index]].name}。`)
      run.skills[action.index] = run.offeredSkill; run.cooldowns[action.index] = 0; advance(state); return state
    }
    if (action.type === 'continue' && !run.loot) { advance(state); return state }
  }
  return current
}

// Validate the complete persisted shape before permitting it back into the reducer.
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const number = (v: unknown, max = Number.MAX_SAFE_INTEGER): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= max
const key = <T extends object>(v: unknown, table: T): v is keyof T => typeof v === 'string' && Object.hasOwn(table, v)
function validGear(v: unknown): v is Gear {
  return record(v) && typeof v.name === 'string' && v.name.length < 80 && key(v.slot, SLOT_NAMES) && ['power', 'vitality', 'defense', 'leech'].every(k => number(v[k]))
}
export function decode(raw: string | null): State {
  try {
    const s: unknown = JSON.parse(raw ?? 'null')
    if (!record(s) || s.version !== 1 || !number(s.seed, 4294967295) || !number(s.souls) || !number(s.legacy, 5) || !number(s.best) || !number(s.runs) || !number(s.wins)) return freshState()
    const r = s.run
    if (r !== null) {
      if (!record(r) || !key(r.job, JOBS) || !number(r.floor) || r.floor < 1 || !number(r.room, 2) || !number(r.level) || r.level < 1 || !number(r.xp, 2) || !number(r.hp) || !number(r.kills) || !number(r.ward, 6)) return freshState()
      // Original ten-floor saves did not track kings defeated within a run.
      if (r.crowns === undefined) r.crowns = r.phase === 'won' ? 1 : 0
      if (!number(r.crowns) || r.crowns > Math.floor(r.floor / 10) || r.crowns > s.wins) return freshState()
      if (!['path', 'battle', 'loot', 'shrine', 'dead', 'won'].includes(String(r.phase))) return freshState()
      if (!Array.isArray(r.skills) || r.skills.length !== 5 || r.skills[0] !== 'strike' || !r.skills.every(v => key(v, SKILLS)) || new Set(r.skills).size !== 5) return freshState()
      if (!Array.isArray(r.cooldowns) || r.cooldowns.length !== 5 || !r.cooldowns.every(v => number(v, 4))) return freshState()
      if (!Array.isArray(r.gear) || r.gear.length > 3 || !r.gear.every(validGear) || new Set(r.gear.map(g => g.slot)).size !== r.gear.length) return freshState()
      if (!Array.isArray(r.paths) || r.paths.length < 1 || r.paths.length > 2 || !r.paths.every(v => key(v, ROOMS))) return freshState()
      if (!Array.isArray(r.log) || r.log.length > 7 || !r.log.every(v => typeof v === 'string' && v.length < 200)) return freshState()
      if (r.loot !== null && !validGear(r.loot) || r.offeredSkill !== null && !key(r.offeredSkill, SKILLS)) return freshState()
      const e = r.enemy
      // Existing encounters keep their original stats and rules until the next room.
      if (record(e)) {
        if (e.trait === undefined) e.trait = 'none'
        if (e.enrages === undefined) e.enrages = false
      }
      if (e !== null && (!record(e) || typeof e.name !== 'string' || e.name.length > 80 || !number(e.kind, 3) || !number(e.hp) || !number(e.maxHp) || e.maxHp < 1 || e.hp > e.maxHp || !number(e.attack) || !number(e.turn) || !number(e.poison) || typeof e.elite !== 'boolean')) return freshState()
      if (record(e) && (!key(e.trait, ENEMY_TRAITS) || typeof e.enrages !== 'boolean')) return freshState()
      if (r.phase === 'battle' && (e === null || (e as Enemy).hp === 0) || r.phase !== 'dead' && r.hp === 0 || r.phase === 'dead' && r.hp !== 0 || r.phase === 'won' && r.floor !== 10) return freshState()
      if (r.offeredSkill && (r.skills as unknown[]).includes(r.offeredSkill)) return freshState()
      if (r.hp > stats(s as State).maxHp) return freshState()
    }
    return s as State
  } catch { return freshState() }
}
export function readSave(): State { try { return decode(localStorage.getItem(SAVE_KEY)) } catch { return freshState() } }
export function save(state: State): boolean { try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); return true } catch { return false } }
