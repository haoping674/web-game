import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useGameActivity } from '../../hooks/useGameActivity'
import { readAppStorage, recordLengthResult, type GlobalSettings } from '../../shared/storage/appStorage'
import { TimingAudio } from '../second-sense/audio'
import { clampLength, INITIAL_LENGTH, judgeLength, randomLength, type LengthResult } from './model'
import '../second-sense/second-sense.css'
import './length-sense.css'

type Props = { globalSettings: GlobalSettings; onProgressChange: () => void; platformSettingsOpen: boolean }
type Phase = 'idle' | 'observe' | 'draw' | 'result'
const QUALITY = { perfect: 3, excellent: 3, great: 2, close: 1, retry: 0 }

export default function LengthSenseGame({ globalSettings, onProgressChange, platformSettingsOpen }: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [target, setTarget] = useState(5000)
  const [guess, setGuess] = useState(INITIAL_LENGTH)
  const [result, setResult] = useState<LengthResult | null>(null)
  const [history, setHistory] = useState<LengthResult[]>([])
  const [progress, setProgress] = useState(() => readAppStorage().games.lengthSense)
  const [newBest, setNewBest] = useState(false)
  const [notice, setNotice] = useState('')
  const phaseRef = useRef<Phase>('idle')
  const railRef = useRef<HTMLDivElement>(null)
  const rangeRef = useRef<HTMLInputElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)
  const actionRef = useRef<HTMLButtonElement>(null)
  const audio = useRef<TimingAudio | null>(null)
  const round = useRef(0)
  const active = phase === 'observe' || phase === 'draw'
  useGameActivity(active)

  const transition = useCallback((next: Phase) => { phaseRef.current = next; setPhase(next) }, [])
  const cancel = useCallback(() => {
    if (phaseRef.current !== 'observe' && phaseRef.current !== 'draw') return
    transition('idle')
    setNotice('這局已取消，不計成績。準備好就再試一次。')
    audio.current?.stop()
  }, [transition])

  const activate = useCallback(() => {
    if (platformSettingsOpen || document.visibilityState === 'hidden') return
    if (phaseRef.current === 'idle' || phaseRef.current === 'result') {
      round.current += 1
      setTarget(randomLength())
      setGuess(INITIAL_LENGTH)
      setResult(null)
      setNewBest(false)
      setNotice('')
      transition('observe')
      if (globalSettings.soundEnabled) { audio.current ??= new TimingAudio(); audio.current.play(-1) }
    } else if (phaseRef.current === 'observe') {
      transition('draw')
      // Move keyboard focus to the newly mounted range after the DOM commits.
      requestAnimationFrame(() => { if (phaseRef.current === 'draw') rangeRef.current?.focus({ preventScroll: true }) })
    } else {
      const outcome = judgeLength(target, guess)
      // Claim the round synchronously so rapid clicks can never score it twice.
      transition('result')
      const previousBest = readAppStorage().games.lengthSense.lengthBestErrorBp
      setNewBest(previousBest === undefined || outcome.errorBp < previousBest)
      setProgress(recordLengthResult(outcome.errorBp).games.lengthSense)
      setResult(outcome)
      setHistory((items) => [outcome, ...items].slice(0, 5))
      if (globalSettings.soundEnabled) { audio.current ??= new TimingAudio(); audio.current.play(QUALITY[outcome.tier]) }
      onProgressChange()
      actionRef.current?.focus({ preventScroll: true })
      requestAnimationFrame(() => resultRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'auto' }))
    }
  }, [globalSettings.soundEnabled, platformSettingsOpen, transition, target, guess, onProgressChange])

  useEffect(() => {
    const visibility = () => { if (document.visibilityState === 'hidden') cancel() }
    const keys = (event: KeyboardEvent) => {
      if (platformSettingsOpen || event.code !== 'Escape') return
      cancel()
    }
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('orchard-arcade:settings-open', cancel)
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
      window.removeEventListener('keydown', keys)
      observer?.disconnect()
    }
  }, [cancel, platformSettingsOpen])

  useEffect(() => { if (!globalSettings.soundEnabled) audio.current?.stop() }, [globalSettings.soundEnabled])
  useEffect(() => () => audio.current?.stop(), [])

  const reduced = globalSettings.reducedMotion || globalSettings.effectIntensity !== 'full'
  const resultTier = phase === 'result' ? result?.tier : undefined
  const buttonText = phase === 'observe' ? '記住了，開始還原' : phase === 'draw' ? '就是這個長度！' : phase === 'result' ? '再挑戰一次' : '開始長度挑戰'
  const best = progress.lengthBestErrorBp

  return (
    <section className={`second-sense length-sense length-phase-${phase} sense-${resultTier ?? 'idle'}${reduced ? ' sense-reduced' : ''}`} aria-labelledby="length-title">
      <header className="sense-heading"><div><p className="eyebrow">LENGTH SENSE / 長度直覺</p><h1 id="length-title">長感挑戰<span>不用尺，眼睛說了算。</span></h1></div><span className="sense-edition">A LITTLE STRETCH<br />OF YOUR PERCEPTION ↔</span></header>
      <div className="sense-layout">
        <div className="sense-play length-play">
          <div className="sense-topline"><span><i />{phase === 'observe' ? '把這段長度，記在眼裡' : phase === 'draw' ? '憑感覺，拉回剛才的長度' : phase === 'result' ? '揭曉你的長度感' : '今天的眼力，準備好了嗎？'}</span><span>LOOK / DRAW / FEEL</span></div>
          <ol className="length-steps" aria-label="遊戲步驟">{['記住長度', '憑感覺拉', '揭曉結果'].map((label, index) => <li key={label} aria-current={(phase === 'observe' && index === 0) || (phase === 'draw' && index === 1) || (phase === 'result' && index === 2) ? 'step' : undefined}><span>0{index + 1}</span>{label}</li>)}</ol>
          <div className="length-stage">
            <div className="length-stage-heading" aria-live="polite"><span>{phase === 'observe' ? '仔細看。不用急。' : phase === 'draw' ? '剛剛，大概這麼長？' : resultTier ? result?.label : '你的眼睛，自帶一把尺。'}</span><p>{phase === 'observe' ? '記住線段從左端到右端的距離，準備好再繼續。' : phase === 'draw' ? '拖曳圓點調整長度，滿意後按下方按鈕。' : phase === 'result' ? '兩條線的起點相同，看看終點相差多少。' : '先看一段線，再讓手還原眼睛記住的距離。'}</p></div>
            <div className="length-workspace" ref={railRef}>
              <div className="length-anchor" aria-hidden="true"><span>起點</span></div>
              {phase === 'idle' ? <div className="length-idle-art" aria-hidden="true"><i /><i /><span>HOW LONG IS A FEELING?</span></div> : null}
              {phase === 'observe' ? <div className="length-reference" aria-label="要記住的目標線段" style={{ width: `${target / 100}%` }}><span className="length-line-tag">記住這段長度</span><i /></div> : null}
              {phase === 'draw' ? <><div className="length-guess-line" aria-hidden="true" style={{ width: `${guess / 100}%` }} /><input ref={rangeRef} className="length-range" type="range" min={0} max={10000} step={10} value={guess} aria-label="調整線段長度" aria-valuetext="長度保密，送出後揭曉" aria-describedby="length-input-help" disabled={platformSettingsOpen} onChange={(event) => setGuess(clampLength(Number(event.target.value)))} onKeyDown={(event) => {
                if (event.key === 'Enter') { event.preventDefault(); if (!event.repeat) activate() }
                if (event.shiftKey && ['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp'].includes(event.key)) {
                  event.preventDefault()
                  const direction = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1 : -1
                  setGuess((value) => clampLength(value + direction * 200))
                }
              }} /></> : null}
              {phase === 'result' && result ? <div className="length-comparison" key={round.current} aria-label="長度比較"><div className="length-original" style={{ width: `${result.target / 100}%` }}><span>目標長度</span><i /></div><div className="length-answer" style={{ width: `${result.guess / 100}%` }}><span>你的長度</span><i /></div><div className="length-gap" style={{ left: `${Math.min(result.target, result.guess) / 100}%`, width: `${Math.abs(result.delta) / 100}%` }} /></div> : null}
              {resultTier && resultTier !== 'retry' ? <div className="length-celebration" key={`burst-${round.current}`} aria-hidden="true">{Array.from({ length: QUALITY[resultTier] * 10 }, (_, index) => <i key={index} style={{ '--angle': `${index * 137.5}deg`, '--distance': `${65 + index % 4 * 28}px`, '--delay': `${index % 4 * 25}ms` } as CSSProperties} />)}<span>✦</span></div> : null}
            </div>
            <p className="length-input-help" id="length-input-help">{phase === 'draw' ? '滑動調整 · 方向鍵微調，Shift + 方向鍵快速調整 · Esc 取消' : phase === 'observe' ? '每局隨機長度 · 沒有時間限制' : '看一眼，拉一下，找到剛剛好的感覺。'}</p>
            <button type="button" ref={actionRef} className="length-action" disabled={platformSettingsOpen} onClick={activate}>{buttonText}<span aria-hidden="true">{phase === 'result' ? '↻' : phase === 'draw' ? '✓' : '→'}</span></button>
          </div>
          <div ref={resultRef} className="sense-result length-result" role="status" aria-live="polite" aria-atomic="true">{phase === 'result' && result ? <div className="sense-result-content" key={round.current}><div><span>{result.delta === 0 ? '剛剛好' : result.delta > 0 ? '比目標長了' : '比目標短了'}</span><strong>{(result.errorBp / 100).toFixed(2)}<small>%</small></strong></div><div><span>本次精準分</span><strong>{result.score}<small>/ 1000</small></strong></div>{newBest ? <span className="sense-result-badge">↗ 個人新紀錄</span> : null}</div> : <p>{notice || (phase === 'observe' ? '不用背數字，只記住那個長度。' : phase === 'draw' ? '目標已藏起來。相信你剛剛看到的。' : '越接近原來的長度，回饋越痛快。')}</p>}</div>
        </div>
        <aside className="sense-sidebar"><section className="sense-record"><p className="eyebrow">YOUR PERSONAL BEST</p><h2>眼力，也有好手感。</h2><span className="sense-best-number">{best === undefined ? '—' : (best / 100).toFixed(2)}<small>%</small></span><p>最小相對誤差 · 越小越準</p><div className="sense-record-list"><div><span>最高精準分</span><strong>{progress.highScore} / 1000</strong></div><div><span>已完成挑戰</span><strong>{progress.gamesPlayed} 次</strong></div></div><small>最佳紀錄自動儲存於本機</small></section><section className="sense-guide"><span aria-hidden="true">↔</span><h2>差一點，也是一種進步。</h2><p>記住距離，讓手跟上眼睛。<br />不計時，慢慢找到自己的準度。</p><div><span>誤差 ≤ 1%</span><strong>✦ 分毫不差</strong></div><div><span>誤差 ≤ 3%</span><strong>眼睛就是尺</strong></div><div><span>誤差 ≤ 6%</span><strong>漂亮的長度感</strong></div><div><span>誤差 ≤ 10%</span><strong>再靠近一點</strong></div></section></aside>
      </div>
      <section className="sense-history" aria-label="最近長度挑戰"><span>最近的眼力<small>本次遊玩</small></span>{history.length ? <ol>{history.map((item, index) => <li key={`${history.length}-${index}`}><span>{item.delta === 0 ? '剛剛好' : item.delta > 0 ? '偏長' : '偏短'}</span><strong>{(item.errorBp / 100).toFixed(2)}%</strong><small>{item.score} 精準分</small></li>)}</ol> : <p>第一段剛剛好的長度，等你拉出來。</p>}</section>
    </section>
  )
}
