import { useCallback, useEffect, useReducer, useRef, useState, type CSSProperties } from 'react'
import { OverlayDialog } from '../../components/OverlayDialog'
import { readAppStorage, saveAppStorage, type GlobalSettings } from '../../shared/storage/appStorage'
import { formatAmount, islandLevel, islandReducer, multiplier, plantCost, production, readIsland, saveIsland, tapValue, upgradeCost, voyageReward } from './model'
import './sprout-island.css'

const SPECIES = ['豆豆芽', '小葉球', '三葉精靈', '花苞球', '莓果精靈', '向日葵', '森林守護者', '星光樹']
const ICONS = ['🌱', '🌿', '☘️', '🌷', '🍓', '🌻', '🌳', '✨']
const nameFor = (level: number) => SPECIES[(level - 1) % SPECIES.length]

export default function SproutIslandGame({ globalSettings, onProgressChange }: { globalSettings: GlobalSettings; onProgressChange: () => void }) {
  const [initial] = useState(() => readIsland())
  const [state, dispatch] = useReducer(islandReducer, initial.state)
  const [selected, setSelected] = useState<number | null>(null)
  const [message, setMessage] = useState(initial.earned > 0n ? `歡迎回來！精靈收集了 ${formatAmount(initial.earned)} 陽光。` : '先點一隻豆豆芽，再點另一隻，試試合成！')
  const [dialog, setDialog] = useState<'help' | 'voyage' | 'release' | null>(null)
  const closeDialog = useCallback(() => setDialog(null), [])
  const [saved, setSaved] = useState(true)
  const current = useRef(state)
  current.current = state
  const reduced = globalSettings.reducedMotion || globalSettings.effectIntensity !== 'full'
  const cost = plantCost(state)
  const full = !state.cells.includes(0)
  const highest = islandLevel(state)
  const reward = voyageReward(state)
  const pairs = state.cells.some((level, index) => level > 0 && state.cells.indexOf(level) !== index)

  useEffect(() => {
    const tick = () => { if (!document.hidden) dispatch({ type: 'tick', now: Date.now() }) }
    const persist = () => { saveIsland(current.current) }
    const visibility = () => { if (document.hidden) persist(); else tick() }
    const interval = window.setInterval(tick, 1000)
    window.addEventListener('pagehide', persist)
    document.addEventListener('visibilitychange', visibility)
    return () => { window.clearInterval(interval); window.removeEventListener('pagehide', persist); document.removeEventListener('visibilitychange', visibility); persist() }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => setSaved(saveIsland(state)), 250)
    return () => window.clearTimeout(timer)
  }, [state])

  useEffect(() => {
    const app = readAppStorage()
    if (state.best > app.games.sproutIsland.highScore) {
      saveAppStorage({ ...app, games: { ...app.games, sproutIsland: { ...app.games.sproutIsland, highScore: state.best } } })
      onProgressChange()
    }
  }, [state.best, onProgressChange])

  function choose(index: number) {
    const level = state.cells[index]
    if (!level) { setSelected(null); setMessage('按下「種一隻」，新朋友會住進空地。'); return }
    if (selected === index) { setSelected(null); return }
    if (selected !== null && state.cells[selected] === level) {
      dispatch({ type: 'merge', from: selected, to: index })
      setSelected(null)
      setMessage(`合成成功！Lv. ${level + 1} ${nameFor(level + 1)}，陽光產量變更多了。`)
    } else {
      setSelected(index)
      setMessage(`已選 Lv. ${level} ${nameFor(level)}，再點一隻同級精靈。`)
    }
  }

  return (
    <section className={`sprout-game${reduced ? ' sprout-reduced' : ''}`} aria-label="芽芽小島遊戲">
      <header className="sprout-heading">
        <div><p className="eyebrow">YOUR POCKET-SIZED PARADISE</p><h1>芽芽小島<span>✳</span></h1></div>
        <button type="button" className="sprout-help" onClick={() => setDialog('help')} aria-label="芽芽小島玩法說明">?</button>
      </header>
      <div className="sprout-stats">
        <div><span>☀ 陽光</span><strong title={state.sunlight.toString()}>{formatAmount(state.sunlight)}</strong></div>
        <div><span>自動收集 / 秒</span><strong>+{formatAmount(production(state))}</strong></div>
        <div><span>永久成長</span><strong>×{formatAmount(multiplier(state))}</strong></div>
      </div>
      <div className="sprout-landscape">
        <div className="sprout-sky"><span>慢慢來，每一點都在長大。</span><button type="button" className="sprout-sun" onClick={() => { dispatch({ type: 'tap' }); setMessage(`☀ +${formatAmount(tapValue(state))} 陽光！也可以等精靈自動收集。`) }} aria-label={`收集陽光，每次 ${formatAmount(tapValue(state))}`}><span aria-hidden="true">☀</span><small>點我 +{formatAmount(tapValue(state))}</small></button></div>
        <div className="sprout-board" role="group" aria-label="精靈小島，點兩隻同級精靈合成">
          {state.cells.map((level, index) => {
            const match = selected !== null && index !== selected && level > 0 && level === state.cells[selected]
            return <button type="button" key={index} className={`sprout-cell${level ? ' occupied' : ''}${selected === index ? ' selected' : ''}${match ? ' match' : ''}`} style={{ '--sprout-hue': `${(level - 1) * 29 + 76}` } as CSSProperties} onClick={() => choose(index)} aria-pressed={selected === index} aria-label={level ? `第 ${index + 1} 格，等級 ${level} ${nameFor(level)}${match ? '，可合成' : ''}` : `第 ${index + 1} 格，空地`}>
              {level ? <><span className="sprout-creature" key={level}><i>{ICONS[(level - 1) % ICONS.length]}</i><b aria-hidden="true">•‿•</b></span><span className="sprout-level">Lv. {level}</span></> : <span className="sprout-empty" aria-hidden="true">＋</span>}
            </button>
          })}
        </div>
        <div className="sprout-island-caption"><span>THE LITTLE ISLAND</span><span>{state.cells.filter(Boolean).length} / 12 位小居民</span></div>
      </div>
      <p className="sprout-message" role="status">{message}</p>
      <div className="sprout-actions">
        <button type="button" className="sprout-plant" disabled={full || state.sunlight < cost} onClick={() => { dispatch({ type: 'plant' }); setMessage(`一隻 Lv. ${state.seedLevel} ${nameFor(state.seedLevel)}搬進來了！`); }}><span>🌱 種一隻 <small>Lv. {state.seedLevel}</small></span><strong>{full ? '小島住滿了' : `${formatAmount(cost)} ☀`}</strong></button>
        <button type="button" className="sprout-upgrade" disabled={state.sunlight < upgradeCost(state) || state.seedLevel >= highest} onClick={() => { dispatch({ type: 'upgrade' }); setMessage(`種子升級！以後直接種出 Lv. ${state.seedLevel + 1} 精靈。`); }}><span>↑ 種子升級 <small>Lv. {state.seedLevel + 1}</small></span><strong>{formatAmount(upgradeCost(state))} ☀</strong></button>
      </div>
      <div className="sprout-context">{full ? pairs ? '小島滿了，合成同級精靈就能空出位置。' : '沒有同級精靈？選一隻送行，就能空出位置。' : state.seedLevel >= highest ? '合成更高級精靈，就能解鎖種子升級。' : '升級種子，讓每一次種植都更有力量。'}{selected !== null && <button type="button" onClick={() => setDialog('release')}>送行選中的精靈</button>}</div>
      <button type="button" className="sprout-voyage" onClick={() => setDialog('voyage')}><span className="sprout-voyage-icon" aria-hidden="true">⛵</span><span><strong>{reward > 0n ? '帶著星星，前往下一座島' : '下一段旅程，正在發芽'}</strong><small>{reward > 0n ? `遠航獲得 ${formatAmount(reward)} 顆星，永久提升產量` : `養出 Lv. 8 精靈解鎖遠航 · 目前 Lv. ${highest}`}</small></span><span aria-hidden="true">↗</span></button>
      <footer className="sprout-footer"><span>{saved ? '✓ 自動儲存於這台裝置' : '無法儲存，請檢查瀏覽器儲存空間'}</span><span>離線收成最多 8 小時</span></footer>
      {dialog && <OverlayDialog label={dialog === 'help' ? '芽芽小島玩法說明' : dialog === 'voyage' ? '出發去下一座島' : '送行精靈'} onClose={closeDialog}>
        <p className="eyebrow">SPROUT ISLAND</p><h2>{dialog === 'help' ? '一點點，就長大。' : dialog === 'voyage' ? '新的島，更大的可能。' : '和小精靈說聲再見'}</h2>
        {dialog === 'help' ? <><p>① 點太陽收集陽光，再按「種一隻」。</p><p>② 先點一隻精靈，再點另一隻同級精靈，合成更高等級。選錯時再點一次即可取消。</p><p>③ 精靈每秒自動收集陽光，升級種子能直接種出更高級精靈。</p><p>養出 Lv. 8 精靈就能遠航。每次重新養島，都會留下永久產量加成。沒有倒數，隨時離開，下次接著長大。</p><button type="button" className="primary-button" onClick={() => setDialog(null)}>回小島玩</button></> : dialog === 'voyage' ? <><p>{reward > 0n ? `這次可獲得 ${formatAmount(reward)} 顆星，永久倍率從 ×${formatAmount(multiplier(state))} 提升至 ×${formatAmount(multiplier(state) + reward)}。` : '先合成一隻 Lv. 8 精靈，即可獲得第一顆星。島上最高等級每多 1 級，就多帶走 1 顆星。'}</p><p>遠航會重置目前的精靈、陽光和種子等級。星星與歷史最高等級會永久保留，你也可以留在這座島繼續合成。</p><button type="button" className="primary-button" disabled={!reward} onClick={() => { dispatch({ type: 'voyage' }); setSelected(null); setDialog(null); setMessage('歡迎來到新島！永久加成已生效，一起再長大。') }}>確認遠航</button></> : <><p>送行後，這隻精靈會離開小島，返還 {formatAmount(cost / 2n)} 陽光，空出一格。其他精靈會繼續收集陽光。</p><button type="button" className="primary-button" onClick={() => { if (selected !== null) dispatch({ type: 'release', index: selected }); setSelected(null); setDialog(null); setMessage('謝謝你的陪伴，小島空出了新位置。') }}>確認送行</button></>}
      </OverlayDialog>}
    </section>
  )
}
