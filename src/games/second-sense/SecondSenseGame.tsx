import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useGameActivity } from '../../hooks/useGameActivity'
import { readAppStorage, recordTimingResult, type GlobalSettings } from '../../shared/storage/appStorage'
import { TimingAudio } from './audio'
import { judgeTiming, TARGETS, type Target, type TimingResult } from './model'
import './second-sense.css'

type Props = { globalSettings: GlobalSettings; onProgressChange: () => void; platformSettingsOpen: boolean }
const QUALITY = { perfect: 3, excellent: 3, great: 2, close: 1, retry: 0 }

export default function SecondSenseGame({ globalSettings, onProgressChange, platformSettingsOpen }: Props) {
  const [target, setTarget] = useState<Target>(3)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<TimingResult | null>(null)
  const [history, setHistory] = useState<TimingResult[]>([])
  const [progress, setProgress] = useState(() => readAppStorage().games.secondSense)
  const [notice, setNotice] = useState('')
  const [newBest, setNewBest] = useState(false)
  const startedAt = useRef<number | null>(null)
  const audio = useRef<TimingAudio | null>(null)
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const round = useRef(0)
  useGameActivity(running)

  const clearTimer = useCallback(() => {
    if (timeout.current !== null) clearTimeout(timeout.current)
    timeout.current = null
  }, [])

  const cancelRound = useCallback((message: string) => {
    if (startedAt.current === null) return
    startedAt.current = null
    clearTimer()
    setRunning(false)
    setNotice(message)
    audio.current?.stop()
  }, [clearTimer])

  const activate = useCallback(() => {
    if (platformSettingsOpen || document.visibilityState === 'hidden') return
    const now = performance.now()
    if (startedAt.current === null) {
      startedAt.current = now
      round.current += 1
      setRunning(true)
      setResult(null)
      setNotice('')
      setNewBest(false)
      timeout.current = setTimeout(() => cancelRound('超過 30 秒了，這局不計成績。準備好就再來一次。'), 30_000)
      if (globalSettings.soundEnabled) { audio.current ??= new TimingAudio(); audio.current.play(-1) }
      return
    }
    const outcome = judgeTiming(now - startedAt.current, target)
    startedAt.current = null
    clearTimer()
    const previousBest = readAppStorage().games.secondSense.timingBestMs?.[target]
    setNewBest(previousBest === undefined || outcome.error < previousBest)
    const saved = recordTimingResult(target, outcome.error)
    setProgress(saved.games.secondSense)
    setResult(outcome)
    setRunning(false)
    setHistory((items) => [outcome, ...items].slice(0, 5))
    if (globalSettings.soundEnabled) { audio.current ??= new TimingAudio(); audio.current.play(QUALITY[outcome.tier]) }
    onProgressChange()
  }, [platformSettingsOpen, globalSettings.soundEnabled, target, cancelRound, clearTimer, onProgressChange])

  useEffect(() => {
    const interrupt = () => cancelRound('這局已取消，不計成績。準備好就再來一次。')
    const visibility = () => { if (document.visibilityState === 'hidden') interrupt() }
    const keydown = (event: KeyboardEvent) => {
      if (platformSettingsOpen) return
      if (event.code === 'Escape') { interrupt(); return }
      const element = event.target as HTMLElement | null
      if (event.code !== 'Space' || event.altKey || event.ctrlKey || event.metaKey || element?.closest('input, select, textarea, a, [contenteditable="true"], button:not(.sense-button), [role="dialog"]')) return
      event.preventDefault()
      if (!event.repeat) activate()
    }
    window.addEventListener('keydown', keydown)
    window.addEventListener('orchard-arcade:settings-open', interrupt)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      window.removeEventListener('keydown', keydown)
      window.removeEventListener('orchard-arcade:settings-open', interrupt)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [activate, cancelRound, platformSettingsOpen])

  useEffect(() => {
    if (!globalSettings.soundEnabled) audio.current?.stop()
  }, [globalSettings.soundEnabled])

  useEffect(() => () => { clearTimer(); audio.current?.stop() }, [clearTimer])

  const best = progress.timingBestMs?.[target]
  const reduced = globalSettings.reducedMotion || globalSettings.effectIntensity !== 'full'
  const phase = running ? 'running' : result ? result.tier : 'idle'

  return (
    <section className={`second-sense sense-${phase}${reduced ? ' sense-reduced' : ''}`} aria-labelledby="sense-title">
      <header className="sense-heading"><div><p className="eyebrow">SECOND SENSE / 直覺計時</p><h1 id="sense-title">秒感挑戰<span>剛剛好，就是這一秒。</span></h1></div><span className="sense-edition">A LITTLE TEST<br />OF YOUR INNER CLOCK ↙</span></header>
      <div className="sense-layout">
        <div className="sense-play">
          <div className="sense-topline"><span><i />{running ? '相信你的時間感' : result ? '每一瞬，都更接近' : '把時間，交給感覺'}</span><span>01 / 03 / 05</span></div>
          <div className="sense-targets" role="group" aria-label="目標秒數">{TARGETS.map((seconds) => <button type="button" key={seconds} aria-label={`${seconds} 秒挑戰`} aria-pressed={target === seconds} disabled={running} onClick={() => { setTarget(seconds); setResult(null); setNotice(''); setNewBest(false) }}><strong>{seconds}</strong><span>秒挑戰</span></button>)}</div>
          <div className="sense-stage">
            <span className="sense-orbit orbit-one" aria-hidden="true" /><span className="sense-orbit orbit-two" aria-hidden="true" />
            <div className="sense-stage-caption" aria-live="polite">{running ? '在心裡數，到點就按。' : result ? result.label : <>你的目標 <strong>{target}.000</strong> 秒</>}</div>
            {result && <div className="sense-burst" key={round.current} aria-hidden="true">{Array.from({ length: 8 + QUALITY[result.tier] * 10 }, (_, index) => <i key={index} style={{ '--angle': `${index * 137.5}deg`, '--distance': `${100 + index % 4 * 24}px`, '--delay': `${index % 5 * 18}ms` } as CSSProperties} />)}
              <span className="sense-shockwave" /><span className="sense-shockwave second-wave" /></div>}
            <button type="button" className="sense-button" onClick={activate} aria-label={running ? '停止計時' : result ? '再挑戰一次' : '開始計時'} disabled={platformSettingsOpen}>
              <span className="sense-button-symbol" aria-hidden="true">{running ? '■' : result ? '↻' : '▶'}</span><strong>{running ? '停！' : result ? '再來一次' : '開始'}</strong><small>{running ? 'STOP' : result ? 'ONE MORE TRY' : 'FEEL THE MOMENT'}</small>
            </button>
            <p className="sense-input-hint">點擊按鈕，或按空白鍵{running ? '停止' : '開始'}{running ? ' · Esc 取消' : ''}</p>
          </div>
          <div className="sense-result" role="status" aria-live="polite" aria-atomic="true">
            {result ? <div key={round.current} className="sense-result-content"><div><span>你按下的瞬間</span><strong>{(result.elapsed / 1000).toFixed(3)}<small>秒</small></strong></div><div className="sense-error"><span>{result.delta === 0 ? '分毫不差' : result.delta < 0 ? '提早了' : '晚了'}</span><strong>{(result.error / 1000).toFixed(3)}<small>秒</small></strong></div><span className="sense-result-badge">{newBest ? '↗ 個人新紀錄' : `${result.score} 精準分`}</span></div> : <p>{notice || (running ? '秒數先保密，讓直覺帶路。' : '按一下開始，再按一下停止。離目標越近，驚喜越大。')}</p>}
          </div>
        </div>
        <aside className="sense-sidebar">
          <section className="sense-record"><p className="eyebrow">YOUR PERSONAL BEST</p><h2>和自己的秒感較量</h2><span className="sense-best-number">{best === undefined ? '—.———' : (best / 1000).toFixed(3)}<small>秒</small></span><p>{target} 秒挑戰 · 最小誤差</p><div className="sense-record-list">{TARGETS.map((seconds) => <div key={seconds}><span>{seconds} 秒</span><strong>{progress.timingBestMs?.[seconds] === undefined ? '等你來挑戰' : `±${(progress.timingBestMs[seconds]! / 1000).toFixed(3)} s`}</strong></div>)}</div><small>紀錄自動儲存於本機 · 已挑戰 {progress.gamesPlayed} 次</small></section>
          <section className="sense-guide"><span aria-hidden="true">✳</span><h2>越接近，越痛快。</h2><p>放輕鬆，找到自己的拍子。<br />不用看錶，你的直覺比想像中準。</p><div><span>誤差 ≤ 0.030 秒</span><strong>✦ 完美瞬間</strong></div><div><span>誤差 ≤ 0.080 秒</span><strong>神乎其技</strong></div><div><span>誤差 ≤ 0.150 秒</span><strong>漂亮的手感</strong></div><div><span>誤差 ≤ 0.300 秒</span><strong>就差一點點</strong></div></section>
        </aside>
      </div>
      <section className="sense-history" aria-label="最近挑戰"><span>最近的手感 <small>本次遊玩</small></span>{history.length ? <ol>{history.map((item, index) => <li key={`${history.length}-${index}`}><span>{item.target} 秒挑戰</span><strong>{(item.elapsed / 1000).toFixed(3)} s</strong><small>{item.delta < 0 ? '早' : item.delta > 0 ? '晚' : '正好'} {item.error} ms</small></li>)}</ol> : <p>第一個剛剛好的瞬間，從這裡開始。</p>}</section>
    </section>
  )
}
