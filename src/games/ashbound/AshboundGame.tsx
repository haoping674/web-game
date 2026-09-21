import { useCallback, useEffect, useReducer, useState } from 'react'
import { OverlayDialog } from '../../components/OverlayDialog'
import { PwaUpdateNotice } from '../../components/PwaUpdateNotice'
import { readAppStorage, saveAppStorage, type GlobalSettings } from '../../shared/storage/appStorage'
import { intent, JOBS, legacyCost, readSave, reducer, ROOMS, save, SKILLS, SLOT_NAMES, stats, type Gear, type Job } from './model'
import './ashbound.css'
import { LeaderboardPanel } from '../../shared/leaderboard/LeaderboardPanel'

function Effigy({ kind = 0 }: { kind?: number }) {
  return <svg className={`ash-effigy effigy-${kind}`} viewBox="0 0 400 340" fill="none" aria-hidden="true">
    <circle cx="200" cy="157" r="119" stroke="currentColor" opacity=".2" />
    <circle cx="200" cy="157" r="103" stroke="currentColor" strokeDasharray="2 12" opacity=".35" />
    <path d="M200 17V44M200 270V298M61 157H88M312 157H339M103 60L122 79M278 235L297 254M103 254L122 235M278 79L297 60" stroke="currentColor" opacity=".4" />
    <path d="M107 306L134 191L157 163L165 94L200 61L235 94L243 163L266 191L293 306L237 286L200 314L161 286Z" fill="#242b29" stroke="#809082" strokeWidth="2" />
    <path d="M165 95L200 75L235 95L227 154L200 182L173 154Z" fill="#101717" stroke="#a8b29b" />
    <path d="M173 114L193 122L180 132ZM227 114L207 122L220 132Z" fill="#e7b778" />
    <path d="M193 152H207M200 143V163M157 175L182 200L166 277M243 175L218 200L234 277M180 187L200 212L220 187M200 213V289" stroke="#89937e" strokeWidth="2" />
    <path d="M145 197L127 241L159 230M255 197L273 241L241 230M140 265L124 289M260 265L276 289" stroke="#89937e" />
    {kind === 1 || kind === 3 ? <path d="M169 94L143 49L181 69L200 29L219 69L257 49L231 94" fill="#353c31" stroke="#d3af74" strokeWidth="2" /> : null}
    {kind === 2 ? <path d="M166 104L131 86L152 139M234 104L269 86L248 139M180 144L186 164M220 144L214 164" stroke="#b9c396" strokeWidth="3" /> : null}
    <path d="M107 171L96 297M94 168L120 170M99 164L114 123L118 168" stroke="#c9bb98" strokeWidth="3" />
    <path d="M282 218V257M269 255H295L290 278H274Z" stroke="#d2ac70" strokeWidth="2" />
    <path d="M282 258L276 270H288Z" fill="#edb76b" />
    <ellipse cx="200" cy="320" rx="121" ry="5" fill="currentColor" opacity=".09" />
  </svg>
}

function GearDescription({ gear }: { gear: Gear }) {
  return <span className="ash-gear-values">{[
    gear.power ? `攻擊 +${gear.power}` : '', gear.vitality ? `生命 +${gear.vitality}` : '',
    gear.defense ? `護甲 +${gear.defense}` : '', gear.leech ? `命中回血 +${gear.leech}` : '',
  ].filter(Boolean).join(' · ')}</span>
}

export default function AshboundGame({ globalSettings, onProgressChange }: { globalSettings: GlobalSettings; onProgressChange: () => void }) {
  const [state, dispatch] = useReducer(reducer, undefined, readSave)
  const [job, setJob] = useState<Job>('warden')
  const [dialog, setDialog] = useState<'help' | 'retire' | null>(null)
  const [saved, setSaved] = useState(true)
  const closeDialog = useCallback(() => setDialog(null), [])
  const run = state.run, attributes = run ? stats(state) : null
  const ended = run?.phase === 'dead' || run?.phase === 'won'

  useEffect(() => { setSaved(save(state)) }, [state])
  useEffect(() => {
    const app = readAppStorage(), previous = app.games.ashbound
    if (previous.highScore < state.best || previous.gamesPlayed < state.runs) {
      saveAppStorage({ ...app, games: { ...app.games, ashbound: { ...previous, highScore: Math.max(previous.highScore, state.best), gamesPlayed: Math.max(previous.gamesPlayed, state.runs) } } })
      onProgressChange()
    }
  }, [state.best, state.runs, onProgressChange])

  return <section className="ash-game" aria-label="灰燼墓誌遊戲">
    <header className="ash-heading">
      <div><p className="ash-overline">ASHBOUND / A ROGUELIKE CHRONICLE</p><h1>灰燼墓誌<span>亡者的下一頁，由你寫下。</span></h1></div>
      <button type="button" className="ash-small" onClick={() => setDialog('help')}>遊玩指南 ↗</button>
    </header>
    {!run ? <div className="ash-camp">
      <div className="ash-camp-art"><span className="ash-seal">MEMENTO<br />MORI</span><Effigy kind={3} /><p>地底沒有日出。<br />但你還有一點火。</p></div>
      <div className="ash-camp-copy">
        <p className="ash-overline">CHAPTER 01 — THE AWAKENING</p><h2>借一具軀殼。<br /><em>再入深淵。</em></h2>
        <p className="ash-muted">選擇職業，穿越十層墓穴。路線、戰利品與每一個回合，都可能改寫你的終局。</p>
        <div className="ash-jobs" role="group" aria-label="選擇職業">{(Object.keys(JOBS) as Job[]).map(id => <button type="button" key={id} aria-pressed={job === id} onClick={() => setJob(id)}><span>{id === 'warden' ? '†' : id === 'witch' ? '✦' : '☽'}</span><strong>{JOBS[id].name}</strong><small>生命 {JOBS[id].hp + state.legacy * 5} / 攻擊 {JOBS[id].power + state.legacy}</small></button>)}</div>
        <p className="ash-job-description">{JOBS[job].description}</p>
        <div className="ash-start-skills">{JOBS[job].skills.map(id => <span key={id} title={SKILLS[id].description}>{SKILLS[id].icon} {SKILLS[id].name}</span>)}</div>
        <button type="button" className="ash-primary" onClick={() => dispatch({ type: 'start', job, seed: crypto.getRandomValues(new Uint32Array(1))[0] })}>喚醒{JOBS[job].name}<span>進入墓穴 →</span></button>
        <div className="ash-legacy"><div><small>永久傳承 · {state.souls} 魂燼</small><strong>餘火 {state.legacy} / 5</strong><span>每級永久 +5 生命、+1 攻擊</span></div><button type="button" disabled={state.legacy >= 5 || state.souls < legacyCost(state)} onClick={() => dispatch({ type: 'upgrade' })}>{state.legacy >= 5 ? '傳承已滿' : `點燃 · ${legacyCost(state)} 魂燼`}</button></div>
        <p className="ash-record">最深 {state.best} 層 <span>／</span> 墓誌 {state.runs} 次 <span>／</span> 破曉 {state.wins} 次</p>
      </div>
    </div> : <>
      <div className="ash-depth"><span>地下 <strong>{String(run.floor).padStart(2, '0')}</strong> / 10 層</span><div aria-label={`本層第 ${run.room + 1} 個房間`}>{[0, 1, 2].map(i => <i key={i} className={i <= run.room ? 'lit' : ''} />)}</div><span>{run.floor <= 4 ? '遺忘墓園' : run.floor <= 9 ? '沉鐘深所' : '無晝王庭'} · 第 {run.room + 1} 室</span></div>
      <div className="ash-expedition">
        <aside className="ash-character">
          <p className="ash-overline">{JOBS[run.job].title}</p><h2>{JOBS[run.job].name}<small>Lv. {run.level}</small></h2>
          <div className="ash-health-label"><span>生命</span><strong>{run.hp} / {attributes!.maxHp}</strong></div>
          <meter className="ash-health" min={0} max={attributes!.maxHp} value={run.hp} aria-label="角色生命" />
          <div className="ash-attributes"><span>攻擊<strong>{attributes!.power}</strong></span><span>護甲<strong>{attributes!.defense}</strong></span><span>命中回血<strong>{attributes!.leech}</strong></span></div>
          <p className="ash-muted ash-xp">經驗 {run.xp} / 3 · 升級回復 30% 生命</p>
          <div className="ash-equipment"><p className="ash-overline">RELICS / 隨身遺物</p>{(['weapon', 'armor', 'charm'] as const).map(slot => { const gear = run.gear.find(g => g.slot === slot); return <div key={slot}><small>{SLOT_NAMES[slot]}</small><strong>{gear?.name ?? '尚未取得'}</strong>{gear ? <GearDescription gear={gear} /> : <span className="ash-gear-values">在戰鬥與棺室中尋找</span>}</div> })}</div>
          {!ended ? <button type="button" className="ash-small ash-retire" onClick={() => setDialog('retire')}>結束這次遠征</button> : null}
        </aside>
        <div className="ash-stage">
          {run.phase === 'path' ? <div className="ash-path"><p className="ash-overline">CHOOSE YOUR DESCENT</p><h2>{run.paths[0] === 'boss' ? '門後，有人等了很久。' : '黑暗中，有兩條路。'}</h2><p className="ash-muted">進入房間後無法回頭。只有你的選擇會推動時間。</p><div className="ash-doors">{run.paths.map((room, index) => <button type="button" key={index} onClick={() => dispatch({ type: 'room', index })}><span className="ash-door-number">0{index + 1} / {room === 'elite' || room === 'boss' ? '危險' : '探索'}</span><span className="ash-door-icon">{ROOMS[room].icon}</span><h3>{ROOMS[room].name}</h3><p>{ROOMS[room].description}</p><span className="ash-door-enter">踏入此處 →</span></button>)}</div></div> : null}
          {run.phase === 'battle' && run.enemy ? <div className="ash-battle">
            <div className="ash-enemy-heading"><div><p className="ash-overline">{run.enemy.kind === 3 ? 'BOSS / 封印守衛' : run.enemy.elite ? 'ELITE / 精英' : 'ENCOUNTER / 遭遇'}</p><h2>{run.enemy.name}</h2></div><span>{run.enemy.hp} / {run.enemy.maxHp}<small>敵人生命</small></span></div>
            <meter className="ash-health enemy-health" min={0} max={run.enemy.maxHp} value={run.enemy.hp} aria-label="敵人生命" />
            <Effigy kind={run.enemy.kind} />
            <div className="ash-intent"><span>下一步</span><strong>{intent(run.enemy).name}</strong><span>原始傷害 {intent(run.enemy).damage}{intent(run.enemy).poison ? ' · 附加腐蝕' : ''}</span></div>
            {run.enemy.poison || run.ward ? <p className="ash-status">{run.enemy.poison ? `敵人中毒 ${run.enemy.poison} 層（每回合 ${run.enemy.poison * 3} 傷害）` : ''}{run.ward ? ` ／ 你被腐蝕：承傷 +${run.ward}，癒合可清除` : ''}</p> : null}
          </div> : null}
          {run.phase === 'loot' ? <div className="ash-choice-panel"><p className="ash-overline">WHAT THE DEAD LEAVE BEHIND</p><span className="ash-large-symbol">{run.loot ? '▱' : '✦'}</span><h2>{run.loot ? '亡者的餘物' : '一段陌生的記憶'}</h2>{run.loot ? <>
            <div className="ash-loot-comparison"><div><small>發現 · {SLOT_NAMES[run.loot.slot]}</small><h3>{run.loot.name}</h3><GearDescription gear={run.loot} /></div><div><small>目前裝備</small>{run.gear.find(g => g.slot === run.loot!.slot) ? <><h3>{run.gear.find(g => g.slot === run.loot!.slot)!.name}</h3><GearDescription gear={run.gear.find(g => g.slot === run.loot!.slot)!} /></> : <h3>空置</h3>}</div></div>
            <div className="ash-actions"><button type="button" className="ash-primary" onClick={() => dispatch({ type: 'loot', equip: true })}>裝備遺物</button><button type="button" onClick={() => dispatch({ type: 'loot', equip: false })}>留下遺物</button></div>
          </> : run.offeredSkill ? <><h3>{SKILLS[run.offeredSkill].name}</h3><p className="ash-muted">{SKILLS[run.offeredSkill].description} 冷卻 {SKILLS[run.offeredSkill].cooldown} 回合。</p><p>替換一項技能；斬擊永久保留。</p><div className="ash-learn">{run.skills.slice(1).map((id, index) => <button type="button" key={id} onClick={() => dispatch({ type: 'learn', index: index + 1 })}>替換 {SKILLS[id].name}<small>{SKILLS[id].description}</small></button>)}</div><button type="button" className="ash-small" onClick={() => dispatch({ type: 'continue' })}>放下記憶，繼續前進 →</button></> : <button type="button" onClick={() => dispatch({ type: 'continue' })}>繼續前進</button>}</div> : null}
          {run.phase === 'shrine' ? <div className="ash-choice-panel"><p className="ash-overline">A BARGAIN WITH THE NAMELESS</p><span className="ash-large-symbol">◇</span><h2>「留下血，帶走力量。」</h2><p className="ash-muted">獻出 {run.hp - Math.ceil(run.hp * .8)} 點當前生命，等級提升 1。<br />本次遠征增加 3 攻擊與 9 生命上限。</p><div className="ash-actions"><button type="button" className="ash-primary" onClick={() => dispatch({ type: 'shrine', accept: true })}>接受契約</button><button type="button" onClick={() => dispatch({ type: 'shrine', accept: false })}>無事離開</button></div></div> : null}
          {ended ? <div className="ash-choice-panel ash-ending"><p className="ash-overline">{run.phase === 'won' ? 'THE FIRST LIGHT' : 'ANOTHER NAME IN ASH'}</p><span className="ash-large-symbol">{run.phase === 'won' ? '☀' : '†'}</span><h2>{run.phase === 'won' ? '終於，看見黎明。' : '此身長眠。餘火不滅。'}</h2><p className="ash-muted">{run.phase === 'won' ? '無晝之王倒下了。你帶著亡者的名字，走向地表。' : '墓穴收下了你的軀殼。留下的魂燼，將為下一位旅人點燈。'}</p><div className="ash-end-stats"><span>抵達<strong>{run.floor} 層</strong></span><span>擊敗<strong>{run.kills} 名</strong></span><span>留下魂燼<strong>+{run.kills * 2 + run.floor + (run.phase === 'won' ? 25 : 0)}</strong></span></div><LeaderboardPanel board="ashbound-souls" score={run.kills * 2 + run.floor + (run.phase === 'won' ? 25 : 0)} resultKey={`ashbound-${state.runs}-${state.seed}-${run.job}`} /><button type="button" className="ash-primary" onClick={() => dispatch({ type: 'camp' })}>返回墓前 · 傳承與重生 →</button></div> : null}
        </div>
      </div>
      {!ended ? <div className="ash-skillbar"><div className="ash-skillbar-label"><span>選擇行動</span><small>{run.phase === 'battle' ? '使用技能後，敵人反擊一次。' : '技能僅可在戰鬥中使用。'} 冷卻按你的行動減少。</small></div><div className="ash-combat-readout" aria-live="polite">{run.phase === 'battle' && run.enemy ? <><span>你的生命 <strong>{run.hp}/{attributes!.maxHp}</strong></span><span>敵人 <strong>{run.enemy.hp}/{run.enemy.maxHp}</strong></span><span>下回合：{intent(run.enemy).name} · {intent(run.enemy).damage}</span></> : null}</div><div className="ash-skills">{run.skills.map((id, index) => <button type="button" key={`${index}-${id}`} disabled={run.phase !== 'battle' || run.cooldowns[index] > 0} onClick={() => dispatch({ type: 'skill', index })} aria-label={`${SKILLS[id].name}${run.cooldowns[index] ? `，冷卻 ${run.cooldowns[index]} 回合` : ''}`}><span className="ash-skill-icon">{SKILLS[id].icon}</span><strong>{SKILLS[id].name}</strong><small>{SKILLS[id].description}</small><span className="ash-cooldown">{run.cooldowns[index] ? `等待 ${run.cooldowns[index]} 回合` : SKILLS[id].cooldown ? `冷卻 ${SKILLS[id].cooldown} 回合` : '無冷卻'}</span></button>)}</div></div> : null}
      <div className="ash-log"><p className="ash-overline">CHRONICLE / 行動紀錄</p><div role="log" aria-label="行動紀錄" aria-live="polite" aria-relevant="additions text">{run.log.map((entry, index) => <p key={`${entry}-${index}`} className={index === 0 ? 'latest' : ''}><span aria-hidden="true">{index === 0 ? '›' : '·'}</span>{entry}</p>)}</div></div>
    </>}
    <footer className="ash-footer"><span>{saved ? '每一步自動儲存 · 可隨時離開再回來' : '無法寫入存檔，離開頁面會遺失進度'}</span><span>回合制 / 無倒數 / {globalSettings.soundEnabled ? '靜謐墓穴' : '音效已關閉'}</span></footer>
    {dialog === 'help' ? <OverlayDialog label="灰燼墓誌遊玩指南" onClose={closeDialog}><p className="eyebrow">ASHBOUND FIELD NOTES</p><h2>帶一點火，走得更遠。</h2><ol className="ash-help"><li><strong>選路。</strong>每層三個房間；第五、十層最後一室是必經首領。營地能回血，精英掉落更好的遺物。</li><li><strong>看敵人意圖。</strong>技能會消耗一回合，敵人隨後反擊。敵人每第三回合重擊，適時使用守夜減傷。擊殺敵人後不會被反擊。</li><li><strong>安排冷卻。</strong>使用其他技能會讓冷卻減少；斬擊永遠可用。冷卻會延續到下場戰鬥，營地重置。</li><li><strong>打造流派。</strong>毒素在你每次行動後傷害敵人；汲取可回血。癒合可清除獵犬造成的腐蝕。裝備同部位會替換，技能最多五格。</li><li><strong>死亡與重生。</strong>遠征死亡會失去本局裝備與等級，保留魂燼。用魂燼升級餘火，再次挑戰。擊敗第十層首領即可通關。</li></ol><p>存檔只在這台裝置。重新整理可續玩，清除瀏覽器資料會移除進度。</p><button type="button" className="primary-button" onClick={closeDialog}>我準備好了</button></OverlayDialog> : null}
    {dialog === 'retire' ? <OverlayDialog label="結束遠征" onClose={closeDialog}><h2>將此身留在墓穴？</h2><p>結束後無法繼續這次遠征，會結算魂燼並保留傳承。只想休息的話，直接返回遊戲廳即可自動存檔。</p><button type="button" className="primary-button" onClick={() => { dispatch({ type: 'retire' }); closeDialog() }}>確認結束並結算</button><button type="button" className="text-button" onClick={closeDialog}>繼續遠征</button></OverlayDialog> : null}
    <PwaUpdateNotice isGameActive={!!run && !ended} />
  </section>
}
