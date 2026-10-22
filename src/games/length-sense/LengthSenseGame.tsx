import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useGameActivity } from '../../hooks/useGameActivity'
import { readAppStorage, recordLengthResult, type GlobalSettings } from '../../shared/storage/appStorage'
import { TimingAudio } from '../second-sense/audio'
import { lengthAtElapsed, judgeLength, LENGTH_TARGETS, PX_PER_CM, type LengthTarget, type LengthResult } from './model'
import '../second-sense/second-sense.css'
import './length-sense.css'

type Props = { globalSettings: GlobalSettings; onProgressChange: () => void; platformSettingsOpen: boolean }
type Hold = { kind: 'pointer'; id: number } | { kind: 'keyboard'; code: string }
const QUALITY = { perfect: 3, excellent: 3, great: 2, close: 1, retry: 0 }

export default function LengthSenseGame({ globalSettings, onProgressChange, platformSettingsOpen }: Props) {
  const [target, setTarget] = useState<LengthTarget>(3)
  const [growing, setGrowing] = useState(false)
  const [length, setLength] = useState(0)
  const [result, setResult] = useState<LengthResult | null>(null)
  const [history, setHistory] = useState<LengthResult[]>([])
  const [progress, setProgress] = useState(() => readAppStorage().games.lengthSense)
  const [newBest, setNewBest] = useState(false)
  const [notice, setNotice] = useState('')
  const railRef = useRef<HTMLDivElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)
  const startedAt = useRef<number | null>(null)
  const hold = useRef<Hold | null>(null)
  const frame = useRef<number | null>(null)
  const maxLength = useRef(8)
  const audio = useRef<TimingAudio | null>(null)
  const round = useRef(0)
  useGameActivity(growing)

  const clearFrame = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
  }, [])
  const cancel = useCallback(() => {
    if (startedAt.current === null) return
    startedAt.current = null
    hold.current = null
    clearFrame()
    setGrowing(false)
    setLength(0)
    setNotice('這局已取消，不計成績。準備好就再試一次。')
    audio.current?.stop()
  }, [clearFrame])

  const finish = useCallback((atLimit = false) => {
    if (startedAt.current === null) return
    // Judge the release timestamp, not the most recently painted frame.
    const outcome = judgeLength(target, lengthAtElapsed(performance.now() - startedAt.current, maxLength.current))
    startedAt.current = null
    hold.current = null
    clearFrame()
    setGrowing(false)
    setLength(outcome.guess)
    setResult(outcome)
    setNotice(atLimit ? '線段已達上限，自動結算。' : '')
    const previousBest = readAppStorage().games.lengthSense.lengthBestErrorBp
    setNewBest(previousBest === undefined || outcome.errorBp < previousBest)
    setProgress(recordLengthResult(outcome.errorBp).games.lengthSense)
    setHistory((items) => [outcome, ...items].slice(0, 5))
    if (globalSettings.soundEnabled) { audio.current ??= new TimingAudio(); audio.current.play(QUALITY[outcome.tier]) }
    onProgressChange()
    requestAnimationFrame(() => resultRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'auto' }))
  }, [target, clearFrame, globalSettings.soundEnabled, onProgressChange])

  const start = useCallback((input: Hold) => {
    if (startedAt.current !== null || platformSettingsOpen || document.visibilityState === 'hidden') return
    const railWidth = railRef.current?.getBoundingClientRect().width ?? 0
    maxLength.current = railWidth > 0 ? Math.min(8, railWidth / PX_PER_CM) : 8
    startedAt.current = performance.now()
    hold.current = input
    round.current += 1
    setGrowing(true)
    setLength(0)
    setResult(null)
    setNewBest(false)
    setNotice('')
    if (globalSettings.soundEnabled) { audio.current ??= new TimingAudio(); audio.current.play(-1) }
    const tick = () => {
      if (startedAt.current === null) return
      const next = lengthAtElapsed(performance.now() - startedAt.current, maxLength.current)
      setLength(next)
      if (next >= maxLength.current) { finish(true); return }
      frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
  }, [platformSettingsOpen, globalSettings.soundEnabled, finish])

  useEffect(() => {
    const visibility = () => { if (document.visibilityState === 'hidden') cancel() }
    const keys = (event: KeyboardEvent) => { if (!platformSettingsOpen && event.code === 'Escape') cancel() }
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('orchard-arcade:settings-open', cancel)
    window.addEventListener('blur', cancel)
    window.addEventListener('keydown', keys)
    const rail = railRef.current
    let width = rail?.getBoundingClientRect().width ?? 0
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width ?? width
      if (width > 0 && Math.abs(next - width) > 1) cancel()
      width = next
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

  useEffect(() => { if (!globalSettings.soundEnabled) audio.current?.stop() }, [globalSettings.soundEnabled])
  useEffect(() => () => { clearFrame(); audio.current?.stop() }, [clearFrame])

  const reduced = globalSettings.reducedMotion || globalSettings.effectIntensity !== 'full'
  const resultTier = result?.tier
  const best = progress.lengthBestErrorBp

  return (
    <section className={`second-sense length-sense length-phase-${growing ? 'growing' : result ? 'result' : 'idle'} sense-${resultTier ?? 'idle'}${reduced ? ' sense-reduced' : ''}`} aria-labelledby="length-title">
      <header className="sense-heading"><div><p className="eyebrow">LENGTH SENSE / 長度直覺</p><h1 id="length-title">長感挑戰<span>按住延伸，放開剛剛好。</span></h1></div><span className="sense-edition">A LITTLE STRETCH<br />OF YOUR PERCEPTION ↔</span></header>
      <div className="sense-layout">
        <div className="sense-play length-play">
          <div className="sense-topline"><span><i />{growing ? '相信眼力，放開就定格' : result ? '揭曉你的長度感' : '今天的眼力，準備好了嗎？'}</span><span>HOLD / GROW / RELEASE</span></div>
          <div className="sense-targets" role="group" aria-label="目標公分數">{LENGTH_TARGETS.map((cm) => <button type="button" key={cm} aria-label={`${cm} 公分挑戰`} aria-pressed={target === cm} disabled={growing || platformSettingsOpen} onClick={() => { setTarget(cm); setResult(null); setLength(0); setNotice(''); setNewBest(false) }}><strong>{cm}</strong><span>公分</span></button>)}</div>
          <div className="length-stage">
            <div className="length-stage-heading" aria-live="polite"><span>{result ? result.label : <>目標 <strong className="length-target-number">{target}</strong> 公分</>}</span><p>{growing ? '線正在長大。覺得到了，就放開。' : result ? '兩條線的起點相同，看看終點相差多少。' : '按住下方按鈕讓線變長，放開立刻結算。'}</p></div>
            <div className="length-workspace" ref={railRef}>
              <div className="length-anchor" aria-hidden="true"><span>起點</span></div>
              {!result ? <div className="length-growing-line" aria-label={growing ? '持續變長的線段' : '等待開始的線段'} style={{ width: `${length * PX_PER_CM}px` }}><i /></div> : <div className="length-comparison" key={round.current} aria-label="長度比較"><div className="length-original" style={{ width: `${result.target * PX_PER_CM}px` }}><span>目標 {result.target.toFixed(2)} cm</span><i /></div><div className="length-answer" style={{ width: `${result.guess * PX_PER_CM}px` }}><span>你的 {result.guess.toFixed(2)} cm</span><i /></div><div className="length-gap" style={{ left: `${Math.min(result.target, result.guess) * PX_PER_CM}px`, width: `${Math.abs(result.delta) * PX_PER_CM}px` }} /></div>}
              {resultTier && resultTier !== 'retry' ? <div className="length-celebration" key={`burst-${round.current}`} aria-hidden="true">{Array.from({ length: QUALITY[resultTier] * 10 }, (_, index) => <i key={index} style={{ '--angle': `${index * 137.5}deg`, '--distance': `${65 + index % 4 * 28}px`, '--delay': `${index % 4 * 25}ms` } as CSSProperties} />)}<span>✦</span></div> : null}
            </div>
            <p className="length-input-help" id="length-input-help">按住滑鼠、手指或空白鍵／Enter · 放開結算 · Esc 取消</p>
            <button type="button" className="length-action" aria-label={growing ? '放開結算' : '按住讓線變長'} aria-describedby="length-input-help" disabled={platformSettingsOpen}
              onPointerDown={(event) => {
                if (event.button !== 0 || event.isPrimary === false) return
                event.preventDefault()
                event.currentTarget.focus({ preventScroll: true })
                event.currentTarget.setPointerCapture?.(event.pointerId)
                start({ kind: 'pointer', id: event.pointerId })
              }}
              onPointerUp={(event) => {
                if (hold.current?.kind === 'pointer' && hold.current.id === event.pointerId) finish()
                if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
              }}
              onPointerCancel={cancel}
              onLostPointerCapture={() => { if (hold.current?.kind === 'pointer') cancel() }}
              onContextMenu={(event) => event.preventDefault()}
              onKeyDown={(event) => {
                if (event.code !== 'Space' && event.code !== 'Enter') return
                event.preventDefault()
                if (!event.repeat) start({ kind: 'keyboard', code: event.code })
              }}
              onKeyUp={(event) => {
                if (event.code !== 'Space' && event.code !== 'Enter') return
                event.preventDefault()
                if (hold.current?.kind === 'keyboard' && hold.current.code === event.code) finish()
              }}
              onBlur={cancel}>
              {growing ? '放開，就是這個長度！' : result ? '再按住，挑戰一次' : '按住，讓線變長'}<span aria-hidden="true">{growing ? '↔' : '●'}</span>
            </button>
            <p className="length-unit-note">以網頁標準公分換算，螢幕上的實體長度可能因裝置而異。</p>
          </div>
          <div ref={resultRef} className="sense-result length-result" role="status" aria-live="polite" aria-atomic="true">{result ? <div className="sense-result-content" key={round.current}><div><span>你的長度</span><strong>{result.guess.toFixed(2)}<small>cm</small></strong></div><div><span>{result.delta === 0 ? '剛剛好' : result.delta > 0 ? '比目標長了' : '比目標短了'}</span><strong>{Math.abs(result.delta).toFixed(2)}<small>cm</small></strong></div><span className="sense-result-badge">誤差 {(result.errorBp / 100).toFixed(2)}%{newBest ? ' · 新紀錄' : ''}</span></div> : <p>{notice || (growing ? '目前長度先保密，放開後揭曉。' : '看目標公分，憑感覺放手。越接近，回饋越痛快。')}</p>}</div>
          {result && notice ? <p className="length-limit-note">{notice}</p> : null}
        </div>
        <aside className="sense-sidebar"><section className="sense-record"><p className="eyebrow">YOUR PERSONAL BEST</p><h2>眼力，也有好手感。</h2><span className="sense-best-number">{best === undefined ? '—' : (best / 100).toFixed(2)}<small>%</small></span><p>最小相對誤差 · 越小越準</p><div className="sense-record-list"><div><span>最高精準分</span><strong>{progress.highScore} / 1000</strong></div><div><span>已完成挑戰</span><strong>{progress.gamesPlayed} 次</strong></div></div><small>最佳紀錄自動儲存於本機</small></section><section className="sense-guide"><span aria-hidden="true">↔</span><h2>差一點，也是一種進步。</h2><p>看著線延伸，在對的地方放手。<br />下一次，讓手感更接近眼力。</p><div><span>誤差 ≤ 1%</span><strong>✦ 分毫不差</strong></div><div><span>誤差 ≤ 3%</span><strong>眼睛就是尺</strong></div><div><span>誤差 ≤ 6%</span><strong>漂亮的長度感</strong></div><div><span>誤差 ≤ 10%</span><strong>再靠近一點</strong></div></section></aside>
      </div>
      <section className="sense-history" aria-label="最近長度挑戰"><span>最近的眼力<small>本次遊玩</small></span>{history.length ? <ol>{history.map((item, index) => <li key={`${history.length}-${index}`}><span>目標 {item.target} cm</span><strong>{item.guess.toFixed(2)} cm</strong><small>{item.delta === 0 ? '剛剛好' : item.delta > 0 ? '偏長' : '偏短'} · {(item.errorBp / 100).toFixed(2)}%</small></li>)}</ol> : <p>第一段剛剛好的長度，等你放手定格。</p>}</section>
    </section>
  )
}
