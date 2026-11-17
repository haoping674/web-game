import { translate } from '../../app/translate'
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useGameActivity } from '../../hooks/useGameActivity'
import { readAppStorage, recordLengthResult, type GlobalSettings } from '../../shared/storage/appStorage'
import { TimingAudio } from '../second-sense/audio'
import { randomInitialLength, judgeLength, LENGTH_TARGETS, PX_PER_CM, type LengthResult } from './model'
import { randomSenseTarget } from '../../shared/gameplay/randomSenseTarget'
import '../second-sense/second-sense.css'
import './length-sense.css'
import { ArcadeResultDialog } from '../../components/ArcadeResultDialog'
import { lengthShareResult } from '../../share/arcadeResults'
import type { ArcadeShareResult } from '../../share/types'

type Props = { globalSettings: GlobalSettings; onProgressChange: () => void; platformSettingsOpen: boolean }
type Phase = 'adjusting' | 'result' | 'cancelled'
const QUALITY = { perfect: 3, excellent: 3, great: 2, close: 1, retry: 0 }

export default function LengthSenseGame({ globalSettings, onProgressChange, platformSettingsOpen }: Props) {
  const [target, setTarget] = useState(3)
  const [randomMode, setRandomMode] = useState(false)
  const [phase, setPhase] = useState<Phase>('adjusting')
  const [length, setLength] = useState(() => randomInitialLength(8))
  const [maxLength, setMaxLength] = useState(8)
  const [dragging, setDragging] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [result, setResult] = useState<LengthResult | null>(null)
  const [history, setHistory] = useState<LengthResult[]>([])
  const [progress, setProgress] = useState(() => readAppStorage().games.lengthSense)
  const [newBest, setNewBest] = useState(false)
  const [summary, setSummary] = useState<ArcadeShareResult | null>(null)
  const [resultOpen, setResultOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const railRef = useRef<HTMLDivElement>(null)
  const sliderRef = useRef<HTMLInputElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)
  const roundOpen = useRef(true)
  const audio = useRef<TimingAudio | null>(null)
  const round = useRef(0)
  useGameActivity(phase === 'adjusting' && dirty)

  const cancel = useCallback(() => {
    if (!roundOpen.current) return
    roundOpen.current = false
    setPhase('cancelled')
    setDragging(false)
    setDirty(false)
    setNotice(translate('這局已取消，不計成績。準備好就再試一次。'))
    audio.current?.stop()
  }, [])

  const start = (nextTarget = target, nextRandomMode = randomMode) => {
    if (platformSettingsOpen || document.visibilityState === 'hidden') return
    setTarget(nextTarget)
    setRandomMode(nextRandomMode)
    setLength(randomInitialLength(maxLength))
    roundOpen.current = true
    round.current += 1
    setPhase('adjusting')
    setDragging(false)
    setDirty(false)
    setResult(null)
    setSummary(null)
    setResultOpen(false)
    setNewBest(false)
    setNotice('')
  }

  const finish = () => {
    if (!roundOpen.current || platformSettingsOpen || dragging || document.visibilityState === 'hidden') return
    roundOpen.current = false
    const outcome = judgeLength(target, length)
    setPhase('result')
    setDirty(false)
    setResult(outcome)
    const previousBest = readAppStorage().games.lengthSense.lengthBestErrorBp
    const personalBest = previousBest === undefined || outcome.errorBp < previousBest
    setNewBest(personalBest)
    setSummary(lengthShareResult(outcome, personalBest))
    setResultOpen(true)
    setProgress(recordLengthResult(outcome.errorBp).games.lengthSense)
    setHistory((items) => [outcome, ...items].slice(0, 5))
    if (randomMode) setTarget(randomSenseTarget())
    if (globalSettings.soundEnabled) { audio.current ??= new TimingAudio(); audio.current.play(QUALITY[outcome.tier]) }
    onProgressChange()
    resultRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'auto' })
  }

  useEffect(() => {
    const visibility = () => { if (document.visibilityState === 'hidden') cancel() }
    const keys = (event: KeyboardEvent) => { if (!event.defaultPrevented && !event.isComposing && event.keyCode !== 229 && !platformSettingsOpen && event.code === 'Escape') cancel() }
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('orchard-arcade:settings-open', cancel)
    window.addEventListener('blur', cancel)
    window.addEventListener('keydown', keys)
    const rail = railRef.current
    let width = rail?.getBoundingClientRect().width ?? 0
    const measure = (next: number) => {
      if (next <= 0) return
      // Keep both the line and its offset handle inside the workspace's padding.
      const limit = Math.floor(Math.min(8, next / PX_PER_CM) * 100) / 100
      setMaxLength(limit)
      setLength((current) => Math.min(current, limit))
    }
    measure(width)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width ?? width
      if (width > 0 && Math.abs(next - width) > 1) cancel()
      width = next
      measure(next)
    })
    if (rail) observer?.observe(rail)
    return () => {
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('orchard-arcade:settings-open', cancel)
      window.removeEventListener('blur', cancel)
      window.removeEventListener('keydown', keys)
      observer?.disconnect()
    }
  }, [cancel, platformSettingsOpen])

  useEffect(() => { if (platformSettingsOpen) cancel() }, [platformSettingsOpen, cancel])
  useEffect(() => { if (!globalSettings.soundEnabled) audio.current?.stop() }, [globalSettings.soundEnabled])
  useEffect(() => () => audio.current?.stop(), [])

  const reduced = globalSettings.reducedMotion || globalSettings.effectIntensity !== 'full'
  const resultTier = result?.tier
  const best = progress.lengthBestErrorBp

  return (
    <section className={`second-sense length-sense length-phase-${phase} sense-${resultTier ?? 'idle'}${reduced ? ' sense-reduced' : ''}`} aria-labelledby="length-title">
      <header className="sense-heading"><div><p className="eyebrow">{translate("LENGTH SENSE / 長度直覺")}</p><h1 id="length-title">{translate("長感挑戰")}<span>{translate("拖出長度，相信你的眼力。")}</span></h1></div><span className="sense-edition">A LITTLE STRETCH<br />OF YOUR PERCEPTION ↔</span></header>
      <div className="sense-layout">
        <div className="sense-play length-play">
          <div className="sense-topline"><span><i />{result ? translate('揭曉你的長度感') : translate('慢慢調整，找到剛剛好')}</span><span>DRAG / JUDGE / CONFIRM</span></div>
          <div className="sense-targets" role="group" aria-label={translate("目標公分數")}>{LENGTH_TARGETS.map((cm) => <button type="button" key={cm} aria-label={translate(`${cm} 公分挑戰`)} aria-pressed={!randomMode && target === cm} disabled={dragging || platformSettingsOpen} onClick={() => { start(cm, false) }}><strong>{cm}</strong><span>{translate("公分")}</span></button>)}<button type="button" aria-label={translate("隨機公分目標")} aria-pressed={randomMode} disabled={dragging || platformSettingsOpen} onClick={() => { start(randomSenseTarget(), true) }}><strong aria-hidden="true">⤨</strong><span>{translate("隨機")}</span></button></div>
          {randomMode ? <p className="sense-random-target" aria-live="polite">{result ? translate('下一局目標') : translate('本局目標')} <strong>{target.toFixed(1)}</strong>{translate(" 公分 ")}<small>{translate("每局抽選 1.0～5.0 公分")}</small></p> : null}
          <div className="length-stage">
            <div className="length-stage-heading" aria-live="polite"><span>{result ? translate(result.label) : <>{translate("目標 ")}<strong className="length-target-number">{target}</strong>{translate(" 公分")}</>}</span><p>{result ? translate('兩條線的起點相同，看看終點相差多少。') : phase === 'cancelled' ? translate('重新開始，再找一次剛剛好的長度。') : translate('拖曳線段下方的圓鈕，調整到你覺得剛好的長度。')}</p></div>
            <div className="length-workspace" ref={railRef}>
              <div className="length-anchor" aria-hidden="true"><span>{translate("起點")}</span></div>
              {!result ? phase === 'adjusting' ? <><div className="length-adjustable-line" aria-label={translate("待確認的線段")} style={{ width: `${length * PX_PER_CM}px` }}><i /></div><div className="length-handle-guide" aria-hidden="true" style={{ left: `${length * PX_PER_CM}px` }} /><input ref={sliderRef} className="length-slider" type="range" min={0} max={maxLength} step={0.01} value={length} aria-label={translate("調整線段長度")} aria-valuetext={translate("長度保密，確認後揭曉")} aria-describedby="length-input-help" disabled={platformSettingsOpen} style={{ width: `${maxLength * PX_PER_CM + 44}px` }} onChange={(event) => { if (roundOpen.current && !platformSettingsOpen) { setLength(Number(event.currentTarget.value)); setDirty(true) } }} onPointerDown={(event) => { if (event.button === 0 && event.isPrimary !== false) setDragging(true) }} onPointerUp={() => setDragging(false)} onPointerCancel={cancel} onLostPointerCapture={() => setDragging(false)} onBlur={() => setDragging(false)} /></> : null : <div className="length-comparison" key={round.current} aria-label={translate("長度比較")}><div className="length-original" style={{ width: `${result.target * PX_PER_CM}px` }}><span>{translate("目標 ")}{result.target.toFixed(2)} cm</span><i /></div><div className="length-answer" style={{ width: `${result.guess * PX_PER_CM}px` }}><span>{translate("你的 ")}{result.guess.toFixed(2)} cm</span><i /></div><div className="length-gap" style={{ left: `${Math.min(result.target, result.guess) * PX_PER_CM}px`, width: `${Math.abs(result.delta) * PX_PER_CM}px` }} /></div>}
              {resultTier && resultTier !== 'retry' ? <div className="length-celebration" key={`burst-${round.current}`} aria-hidden="true">{Array.from({ length: QUALITY[resultTier] * 10 }, (_, index) => <i key={index} style={{ '--angle': `${index * 137.5}deg`, '--distance': `${65 + index % 4 * 28}px`, '--delay': `${index % 4 * 25}ms` } as CSSProperties} />)}<span>✦</span></div> : null}
            </div>
            <p className="length-input-help" id="length-input-help">{translate("拖曳下方圓鈕，線段不遮手 · ← → 微調 · 確認才結算 · Esc 取消")}</p>
            <button type="button" className="length-action" disabled={platformSettingsOpen || dragging}
              onClick={() => {
                if (phase === 'adjusting') finish()
                else { start(); requestAnimationFrame(() => sliderRef.current?.focus({ preventScroll: true })) }
              }}>
              {phase === 'adjusting' ? translate('確認這個長度') : phase === 'result' ? translate('再挑戰一次') : translate('重新開始')}<span aria-hidden="true">{phase === 'adjusting' ? '✓' : '↔'}</span>
            </button>
            <p className="length-unit-note">{translate("以網頁標準公分換算，螢幕上的實體長度可能因裝置而異。")}</p>
          </div>
          <div ref={resultRef} className="sense-result length-result" role="status" aria-live="polite" aria-atomic="true">{result ? <div className="sense-result-content" key={round.current}><div><span>{translate("你的長度")}</span><strong>{result.guess.toFixed(2)}<small>cm</small></strong></div><div><span>{result.delta === 0 ? translate('剛剛好') : result.delta > 0 ? translate('比目標長了') : translate('比目標短了')}</span><strong>{Math.abs(result.delta).toFixed(2)}<small>cm</small></strong></div><span className="sense-result-badge">{translate("誤差 ")}{(result.errorBp / 100).toFixed(2)}%{newBest ? translate(' · 新紀錄') : ''}</span></div> : <p>{notice || translate('可以反覆調整，按確認後才揭曉長度。')}</p>}</div>
          {result && notice ? <p className="length-limit-note">{translate(notice)}</p> : null}
        </div>
        <aside className="sense-sidebar"><section className="sense-record"><p className="eyebrow">YOUR PERSONAL BEST</p><h2>{translate("眼力，也有好手感。")}</h2><span className="sense-best-number">{best === undefined ? '—' : (best / 100).toFixed(2)}<small>%</small></span><p>{translate("最小相對誤差 · 越小越準")}</p><div className="sense-record-list"><div><span>{translate("最高精準分")}</span><strong>{progress.highScore} / 1000</strong></div><div><span>{translate("已完成挑戰")}</span><strong>{progress.gamesPlayed}{translate(" 次")}</strong></div></div><small>{translate("拖曳挑戰紀錄自動儲存於本機")}</small></section><section className="sense-guide"><span aria-hidden="true">↔</span><h2>{translate("差一點，也是一種進步。")}</h2><p>{translate("憑眼力調整，確認你的剛剛好。")}<br />{translate("下一次，讓手感更接近眼力。")}</p><div><span>{translate("誤差 ≤ 1%")}</span><strong>{translate("✦ 分毫不差")}</strong></div><div><span>{translate("誤差 ≤ 3%")}</span><strong>{translate("眼睛就是尺")}</strong></div><div><span>{translate("誤差 ≤ 6%")}</span><strong>{translate("漂亮的長度感")}</strong></div><div><span>{translate("誤差 ≤ 10%")}</span><strong>{translate("再靠近一點")}</strong></div></section></aside>
      </div>
      <section className="sense-history" aria-label={translate("最近長度挑戰")}><span>{translate("最近的眼力")}<small>{translate("本次遊玩")}</small></span>{history.length ? <ol>{history.map((item, index) => <li key={`${history.length}-${index}`}><span>{translate("目標 ")}{item.target} cm</span><strong>{item.guess.toFixed(2)} cm</strong><small>{item.delta === 0 ? translate('剛剛好') : item.delta > 0 ? translate('偏長') : translate('偏短')} · {(item.errorBp / 100).toFixed(2)}%</small></li>)}</ol> : <p>{translate("第一段剛剛好的長度，等你親手決定。")}</p>}</section>
      {summary && !resultOpen && <button type="button" className="text-button" onClick={() => setResultOpen(true)}>{translate('查看本局成果')}</button>}
      {summary && resultOpen && <ArcadeResultDialog result={summary} onClose={() => setResultOpen(false)} onReplay={() => { start(); requestAnimationFrame(() => sliderRef.current?.focus({ preventScroll: true })) }} />}
    </section>
  )
}
