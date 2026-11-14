import { translate } from '../../app/translate'
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useGameActivity } from '../../hooks/useGameActivity'
import { readAppStorage, recordTimingResult, type GlobalSettings } from '../../shared/storage/appStorage'
import { TimingAudio } from './audio'
import { judgeTiming, TARGETS, type TimingResult } from './model'
import { randomSenseTarget } from '../../shared/gameplay/randomSenseTarget'
import './second-sense.css'
import { ArcadeResultDialog } from '../../components/ArcadeResultDialog'
import { timingShareResult } from '../../share/arcadeResults'
import type { ArcadeShareResult } from '../../share/types'

type Props = { globalSettings: GlobalSettings; onProgressChange: () => void; platformSettingsOpen: boolean }
const QUALITY = { perfect: 3, excellent: 3, great: 2, close: 1, retry: 0 }

export default function SecondSenseGame({ globalSettings, onProgressChange, platformSettingsOpen }: Props) {
  const [target, setTarget] = useState(3)
  const [randomMode, setRandomMode] = useState(false)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<TimingResult | null>(null)
  const [history, setHistory] = useState<TimingResult[]>([])
  const [progress, setProgress] = useState(() => readAppStorage().games.secondSense)
  const [notice, setNotice] = useState('')
  const [newBest, setNewBest] = useState(false)
  const [summary, setSummary] = useState<ArcadeShareResult | null>(null)
  const [resultOpen, setResultOpen] = useState(false)
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
      setResultOpen(false)
      setSummary(null)
      setNotice('')
      setNewBest(false)
      timeout.current = setTimeout(() => cancelRound(translate('超過 30 秒了，這局不計成績。準備好就再來一次。')), 30_000)
      if (globalSettings.soundEnabled) { audio.current ??= new TimingAudio(); audio.current.play(-1) }
      return
    }
    const outcome = judgeTiming(now - startedAt.current, target)
    startedAt.current = null
    clearTimer()
    const previousProgress = readAppStorage().games.secondSense
    const previousBest = randomMode ? previousProgress.timingRandomBestMs : previousProgress.timingBestMs?.[target as 1 | 3 | 5]
    const personalBest = previousBest === undefined || outcome.error < previousBest
    setNewBest(personalBest)
    setSummary(timingShareResult(outcome, randomMode, personalBest))
    setResultOpen(true)
    const saved = recordTimingResult(target, outcome.error, undefined, randomMode)
    setProgress(saved.games.secondSense)
    setResult(outcome)
    setRunning(false)
    setHistory((items) => [outcome, ...items].slice(0, 5))
    if (randomMode) setTarget(randomSenseTarget())
    if (globalSettings.soundEnabled) { audio.current ??= new TimingAudio(); audio.current.play(QUALITY[outcome.tier]) }
    onProgressChange()
  }, [platformSettingsOpen, globalSettings.soundEnabled, target, randomMode, cancelRound, clearTimer, onProgressChange])

  useEffect(() => {
    const interrupt = () => cancelRound(translate('這局已取消，不計成績。準備好就再來一次。'))
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

  const best = randomMode ? progress.timingRandomBestMs : progress.timingBestMs?.[target as 1 | 3 | 5]
  const reduced = globalSettings.reducedMotion || globalSettings.effectIntensity !== 'full'
  const phase = running ? 'running' : result ? result.tier : 'idle'

  return (
    <section className={`second-sense sense-${phase}${reduced ? ' sense-reduced' : ''}`} aria-labelledby="sense-title">
      <header className="sense-heading"><div><p className="eyebrow">{translate("SECOND SENSE / 直覺計時")}</p><h1 id="sense-title">{translate("秒感挑戰")}<span>{translate("剛剛好，就是這一秒。")}</span></h1></div><span className="sense-edition">A LITTLE TEST<br />OF YOUR INNER CLOCK ↙</span></header>
      <div className="sense-layout">
        <div className="sense-play">
          <div className="sense-topline"><span><i />{translate(running ? translate('相信你的時間感') : result ? translate('每一瞬，都更接近') : translate('把時間，交給感覺'))}</span><span>01 / 03 / 05</span></div>
          <div className="sense-targets" role="group" aria-label={translate("目標秒數")}>{TARGETS.map((seconds) => <button type="button" key={seconds} aria-label={translate(`${seconds} 秒挑戰`)} aria-pressed={!randomMode && target === seconds} disabled={running} onClick={() => { setRandomMode(false); setTarget(seconds); setResult(null); setNotice(''); setNewBest(false) }}><strong>{seconds}</strong><span>{translate("秒挑戰")}</span></button>)}<button type="button" aria-label={translate("隨機秒數目標")} aria-pressed={randomMode} disabled={running} onClick={() => { setRandomMode(true); setTarget(randomSenseTarget()); setResult(null); setNotice(''); setNewBest(false) }}><strong aria-hidden="true">⤨</strong><span>{translate("隨機")}</span></button></div>
          {randomMode ? <p className="sense-random-target" aria-live="polite">{translate(result ? translate('下一局目標') : translate('本局目標'))} <strong>{translate(target.toFixed(1))}</strong>{translate(" 秒 ")}<small>{translate("每局抽選 1.0～5.0 秒")}</small></p> : null}
          <div className="sense-stage">
            <span className="sense-orbit orbit-one" aria-hidden="true" /><span className="sense-orbit orbit-two" aria-hidden="true" />
            <div className="sense-stage-caption" aria-live="polite">{running ? translate('在心裡數，到點就按。') : result ? translate(result.label) : <>{translate("你的目標 ")}<strong>{translate(target.toFixed(3))}</strong>{translate(" 秒")}</>}</div>
            {result && <div className="sense-burst" key={round.current} aria-hidden="true">{Array.from({ length: 8 + QUALITY[result.tier] * 10 }, (_, index) => <i key={index} style={{ '--angle': `${index * 137.5}deg`, '--distance': `${100 + index % 4 * 24}px`, '--delay': `${index % 5 * 18}ms` } as CSSProperties} />)}
              <span className="sense-shockwave" /><span className="sense-shockwave second-wave" /></div>}
            <button type="button" className="sense-button" onClick={activate} aria-label={translate(running ? translate('停止計時') : result ? translate('再挑戰一次') : translate('開始計時'))} disabled={platformSettingsOpen}>
              <span className="sense-button-symbol" aria-hidden="true">{translate(running ? '■' : result ? '↻' : '▶')}</span><strong>{translate(running ? translate('停！') : result ? translate('再來一次') : translate('開始'))}</strong><small>{translate(running ? 'STOP' : result ? 'ONE MORE TRY' : 'FEEL THE MOMENT')}</small>
            </button>
            <p className="sense-input-hint">{translate("點擊按鈕，或按空白鍵")} {translate(running ? translate('停止') : translate('開始'))}{translate(running ? translate(' · Esc 取消') : '')}</p>
          </div>
          <div className="sense-result" role="status" aria-live="polite" aria-atomic="true">
            {result ? <div key={round.current} className="sense-result-content"><div><span>{translate("本局目標 ")}{translate(result.target.toFixed(1))}{translate(" 秒")}</span><strong>{translate((result.elapsed / 1000).toFixed(3))}<small>{translate("秒")}</small></strong></div><div className="sense-error"><span>{translate(result.delta === 0 ? translate('分毫不差') : result.delta < 0 ? translate('提早了') : translate('晚了'))}</span><strong>{translate((result.error / 1000).toFixed(3))}<small>{translate("秒")}</small></strong></div><span className="sense-result-badge">{translate(newBest ? translate('↗ 個人新紀錄') : `${result.score} 精準分`)}</span></div> : <p>{translate(notice || (running ? translate('秒數先保密，讓直覺帶路。') : translate('按一下開始，再按一下停止。離目標越近，驚喜越大。')))}</p>}
          </div>
        </div>
        <aside className="sense-sidebar">
          <section className="sense-record"><p className="eyebrow">YOUR PERSONAL BEST</p><h2>{translate("和自己的秒感較量")}</h2><span className="sense-best-number">{best === undefined ? '—.———' : (best / 1000).toFixed(3)}<small>{translate("秒")}</small></span><p>{translate(randomMode ? translate('隨機挑戰') : `${target} 秒挑戰`)}{translate(" · 最小誤差")}</p><div className="sense-record-list">{TARGETS.map((seconds) => <div key={seconds}><span>{seconds}{translate(" 秒")}</span><strong>{translate(progress.timingBestMs?.[seconds] === undefined ? translate('等你來挑戰') : `±${(progress.timingBestMs[seconds]! / 1000).toFixed(3)} s`)}</strong></div>)}</div><small>{translate("紀錄自動儲存於本機 · 已挑戰 ")}{progress.gamesPlayed}{translate(" 次")}</small></section>
          <section className="sense-guide"><span aria-hidden="true">✳</span><h2>{translate("越接近，越痛快。")}</h2><p>{translate("放輕鬆，找到自己的拍子。")}<br />{translate("不用看錶，你的直覺比想像中準。")}</p><div><span>{translate("誤差 ≤ 0.030 秒")}</span><strong>{translate("✦ 完美瞬間")}</strong></div><div><span>{translate("誤差 ≤ 0.080 秒")}</span><strong>{translate("神乎其技")}</strong></div><div><span>{translate("誤差 ≤ 0.150 秒")}</span><strong>{translate("漂亮的手感")}</strong></div><div><span>{translate("誤差 ≤ 0.300 秒")}</span><strong>{translate("就差一點點")}</strong></div></section>
        </aside>
      </div>
      <section className="sense-history" aria-label={translate("最近挑戰")}><span>{translate("最近的手感 ")}<small>{translate("本次遊玩")}</small></span>{history.length ? <ol>{history.map((item, index) => <li key={`${history.length}-${index}`}><span>{item.target}{translate(" 秒挑戰")}</span><strong>{translate((item.elapsed / 1000).toFixed(3))} s</strong><small>{translate(item.delta < 0 ? translate('早') : item.delta > 0 ? translate('晚') : translate('正好'))} {item.error} ms</small></li>)}</ol> : <p>{translate("第一個剛剛好的瞬間，從這裡開始。")}</p>}</section>
      {summary && !resultOpen && <button type="button" className="text-button" onClick={() => setResultOpen(true)}>{translate('查看本局成果')}</button>}
      {summary && resultOpen && <ArcadeResultDialog result={summary} onClose={() => setResultOpen(false)} onReplay={activate} replayHint={randomMode ? `${translate('下一局目標')} ${target.toFixed(1)} ${translate('秒')}` : undefined} />}
    </section>
  )
}
