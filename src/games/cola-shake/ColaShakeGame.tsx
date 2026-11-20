import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { OverlayDialog } from '../../components/OverlayDialog'
import { useGameActivity } from '../../hooks/useGameActivity'
import { fixedClock } from '../../shared/immersive/fixedClock'
import { LeaderboardDialog } from '../../shared/leaderboard/LeaderboardDialog'
import { LeaderboardPanel } from '../../shared/leaderboard/LeaderboardPanel'
import { recordGameResult, type GlobalSettings } from '../../shared/storage/appStorage'
import { makeColaAudio } from './colaAudio'
import { ColaRound, SEAL_BREAK, type Phase } from './colaPhysics'
import { makeColaScene } from './colaScene'
import './colaShake.css'

type MotionMode = 'off' | 'pending' | 'active' | 'unavailable'
type Reading = { pressure: number; lid: number; distance: number; phase: Phase }
const INITIAL: Reading = { pressure: 0, lid: 0, distance: 0, phase: 'shake' }
type Props = {
  globalSettings: GlobalSettings
  highScore: number
  onProgressChange: () => void
  platformSettingsOpen: boolean
}

export default function ColaShakeGame({ globalSettings, highScore, onProgressChange, platformSettingsOpen }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const round = useRef(new ColaRound())
  const audio = useRef<ReturnType<typeof makeColaAudio> | null>(null)
  const capHeld = useRef(false)
  const gesture = useRef<{ id: number; anchor: number; width: number } | null>(null)
  const stageVisible = useRef(true)
  const motionStamp = useRef(0)
  const [motion, setMotion] = useState<MotionMode>('off')
  const [touchDevice] = useState(() => window.matchMedia('(any-pointer: coarse)').matches)
  const [reading, setReading] = useState(INITIAL)
  const [result, setResult] = useState(false)
  const [board, setBoard] = useState(false)
  const [heard, setHeard] = useState(true)
  const [sceneError, setSceneError] = useState(false)
  const [sceneVersion, setSceneVersion] = useState(0)
  const pause = platformSettingsOpen || board
  const live = useRef({ pause, globalSettings, onProgressChange })
  useEffect(() => { live.current = { pause, globalSettings, onProgressChange } }, [pause, globalSettings, onProgressChange])
  useGameActivity(reading.phase !== 'result' && (reading.pressure > 0 || reading.phase !== 'shake'))

  useEffect(() => {
    const sound = makeColaAudio()
    audio.current = sound
    return () => { sound.dispose(); audio.current = null }
  }, [])

  useEffect(() => {
    audio.current?.setEnabled(globalSettings.soundEnabled && heard)
  }, [globalSettings.soundEnabled, heard])

  useEffect(() => {
    if (!canvas.current) return
    const surface = canvas.current
    let scene: ReturnType<typeof makeColaScene>
    try { scene = makeColaScene(surface) } catch { setSceneError(true); return }
    let frame = 0
    let previous = 0
    let lastPublish = 0
    let oldRound = round.current
    let publish: Reading = INITIAL
    let contextLost = false
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const clock = fixedClock(dt => {
      const current = round.current
      const oldPhase = current.phase
      const oldOpening = current.opening
      const oldHits = current.impacts
      current.step(dt, capHeld.current)
      if (oldOpening === 0 && current.opening > 0) audio.current?.play('thread', .56)
      if (oldOpening < .66 && current.opening >= .66) audio.current?.play('thread', .38, 1.17)
      if (oldOpening < SEAL_BREAK && current.opening >= SEAL_BREAK) audio.current?.play('hiss', .32 + current.pressure * .48)
      if (oldPhase === 'opening' && current.phase === 'spray') {
        audio.current?.play('burst', .48 + current.launchPressure * .45, .94 + current.launchPressure * .07)
        audio.current?.play('spray', .23 + current.launchPressure * .59, .94, .22)
      }
      if (current.impacts !== oldHits && (oldHits === 0 || current.impacts % 11 === 0)) {
        audio.current?.play('splash', oldHits === 0 ? .63 : .32, 1 + current.lastImpact % .16, .45)
      }
      if (oldPhase === 'spray' && current.phase === 'result') {
        recordGameResult('colaShake', current.distance)
        live.current.onProgressChange()
      }
      if (oldPhase === 'result' && current.age >= current.finishedAt + .55 && current.age - dt < current.finishedAt + .55) setResult(true)
    })
    const tick = (now: number) => {
      frame = 0
      if (contextLost || document.hidden || !stageVisible.current) return
      const dt = previous ? (now - previous) / 1000 : 0
      previous = now
      const current = round.current
      if (oldRound !== current) { clock.reset(); oldRound = current }
      const state = live.current
      if (!state.pause) clock.advance(dt)
      if (current.phase !== publish.phase || current.distance !== publish.distance || now - lastPublish > 75) {
        const next = {
          pressure: Math.round(current.pressure * 100), lid: Math.round(current.opening * 100),
          phase: current.phase, distance: current.distance,
        }
        if (next.pressure !== publish.pressure || next.lid !== publish.lid || next.phase !== publish.phase || next.distance !== publish.distance) {
          setReading(next)
          publish = next
        }
        lastPublish = now
      }
      scene.draw(current, Math.min(dt, .05), state.globalSettings.reducedMotion || preference.matches, state.globalSettings.effectIntensity)
      frame = requestAnimationFrame(tick)
    }
    const syncLoop = () => {
      if (document.hidden || !stageVisible.current || contextLost) {
        cancelAnimationFrame(frame)
        frame = 0
        previous = 0
        capHeld.current = false
        gesture.current = null
        audio.current?.stop()
      } else if (!frame) frame = requestAnimationFrame(tick)
    }
    const intersection = new IntersectionObserver(([entry]) => { stageVisible.current = entry.isIntersecting; syncLoop() })
    intersection.observe(surface)
    const loseContext = (event: Event) => { event.preventDefault(); contextLost = true; syncLoop(); setSceneError(true) }
    document.addEventListener('visibilitychange', syncLoop)
    surface.addEventListener('webglcontextlost', loseContext)
    syncLoop()
    return () => {
      intersection.disconnect()
      document.removeEventListener('visibilitychange', syncLoop)
      surface.removeEventListener('webglcontextlost', loseContext)
      cancelAnimationFrame(frame)
      scene.dispose()
    }
  }, [sceneVersion])

  useEffect(() => {
    if (!pause) return
    capHeld.current = false
    gesture.current = null
    audio.current?.stop()
  }, [pause])

  function shake(direction: number): void {
    if (live.current.pause || document.hidden || !stageVisible.current || !round.current.shake(direction)) return
    audio.current?.play('shake', .49 + round.current.pressure * .30, 1.06 - round.current.pressure * .18, direction * .16)
  }

  useEffect(() => {
    if (motion !== 'pending' && motion !== 'active') return
    let gravity: number[] | undefined
    let axis = 0
    let lastLive = 0
    const timeout = window.setTimeout(() => {
      if (!lastLive && motion === 'pending') setMotion('unavailable')
    }, 2100)
    const receive = (event: DeviceMotionEvent) => {
      const source = event.acceleration
      const raw = event.accelerationIncludingGravity
      const canUse = source && [source.x, source.y, source.z].every(value => typeof value === 'number' && Number.isFinite(value))
      const hasRaw = raw && [raw.x, raw.y, raw.z].every(value => typeof value === 'number' && Number.isFinite(value))
      if (!canUse && !hasRaw) return
      const now = performance.now()
      lastLive = now
      if (motion === 'pending') setMotion('active')
      if (gesture.current || live.current.pause || document.hidden || round.current.phase !== 'shake') return
      let vector = [source?.x ?? 0, source?.y ?? 0, source?.z ?? 0]
      if (!canUse && raw) {
        const sample = [raw.x ?? 0, raw.y ?? 0, raw.z ?? 0]
        gravity ??= [...sample]
        vector = sample.map((value, index) => {
          const baseline = gravity![index]
          gravity![index] = baseline * .92 + value * .08
          return value - baseline
        })
      }
      if (now - motionStamp.current > 450) {
        axis = vector.reduce((strongest, value, index) => Math.abs(value) > Math.abs(vector[strongest]) ? index : strongest, 0)
      }
      if (Math.abs(vector[axis]) >= 3.2) {
        motionStamp.current = now
        shake(Math.sign(vector[axis]))
      }
    }
    window.addEventListener('devicemotion', receive)
    return () => { clearTimeout(timeout); window.removeEventListener('devicemotion', receive) }
  }, [motion])

  async function enableMotion(): Promise<void> {
    audio.current?.unlock()
    if (motion === 'active' || motion === 'pending') { setMotion('off'); return }
    const provider = window.DeviceMotionEvent as (typeof DeviceMotionEvent & { requestPermission?: () => Promise<string> }) | undefined
    if (!provider || !window.isSecureContext) { setMotion('unavailable'); return }
    try {
      if (provider.requestPermission && await provider.requestPermission() !== 'granted') { setMotion('unavailable'); return }
      setMotion('pending')
    } catch { setMotion('unavailable') }
  }

  function dragStart(event: PointerEvent<HTMLCanvasElement>): void {
    if (event.button !== 0 || !event.isPrimary || round.current.phase !== 'shake' || pause) return
    audio.current?.unlock()
    gesture.current = { id: event.pointerId, anchor: event.clientX, width: event.currentTarget.clientWidth }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function dragMove(event: PointerEvent<HTMLCanvasElement>): void {
    const grip = gesture.current
    if (!grip || grip.id !== event.pointerId || round.current.phase !== 'shake') return
    const movement = event.clientX - grip.anchor
    if (Math.abs(movement) < Math.max(24, Math.min(grip.width * .085, 53))) return
    grip.anchor = event.clientX
    shake(Math.sign(movement))
  }

  function beginOpen(): void {
    if (live.current.pause || sceneError || round.current.phase === 'spray' || round.current.phase === 'result') return
    audio.current?.unlock()
    gesture.current = null
    capHeld.current = true
    round.current.beginOpening()
  }

  function releaseOpen(): void { capHeld.current = false }

  function reset(): void {
    audio.current?.stop()
    round.current = new ColaRound()
    releaseOpen()
    gesture.current = null
    setReading(INITIAL)
    setResult(false)
  }

  const pressProps = {
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      if (!event.isPrimary || event.button !== 0) return
      event.currentTarget.setPointerCapture(event.pointerId)
      beginOpen()
    },
    onPointerUp: releaseOpen,
    onPointerCancel: releaseOpen,
    onLostPointerCapture: releaseOpen,
    onBlur: releaseOpen,
    onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key !== ' ' && event.key !== 'Enter') return
      event.preventDefault()
      if (!event.repeat) beginOpen()
    },
    onKeyUp: (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); releaseOpen() }
    },
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
      // Assistive technology can invoke a button without holding a pointer/key.
      if (event.detail === 0) beginOpen()
    },
  }
  const preLaunch = reading.phase === 'shake' || reading.phase === 'opening'
  const active = reading.phase === 'shake'
  const hint = reading.phase === 'opening'
    ? reading.lid >= SEAL_BREAK * 100 ? '泡沫正從瓶蓋邊緣溢出。繼續按住開蓋。' : '繼續按住，瓶蓋正在鬆開。'
    : reading.phase === 'spray' ? '以液滴最遠落點計分。'
      : reading.phase === 'result' ? '本局噴射完畢。'
        : motion === 'active' ? '輕握手機，左右來回搖。' : '按住瓶身左右來回拖曳。'

  return (
    <section className="cola-game" aria-labelledby="cola-title">
      <header className="cola-header">
        <div><p className="eyebrow">解解壓</p><h1 id="cola-title">可樂噴多遠</h1></div>
        <button className="cola-secondary" type="button" onClick={() => setBoard(true)}>線上排行榜</button>
      </header>
      <div className="cola-stage" data-phase={reading.phase}>
        <canvas key={sceneVersion} ref={canvas} aria-hidden="true" onPointerDown={dragStart} onPointerMove={dragMove}
          onPointerUp={() => { gesture.current = null }} onPointerCancel={() => { gesture.current = null }}
          onLostPointerCapture={() => { gesture.current = null }} />
        <div className="cola-readout"><span>最遠落點</span><strong>{reading.distance} <small>cm</small></strong></div>
        {preLaunch && !sceneError && <button type="button" className="cola-cap-target" aria-label="按住瓶蓋" {...pressProps} />}
        {sceneError && <div className="cola-scene-error" role="status">3D 畫面暫時無法顯示。<button type="button" className="cola-secondary" onClick={() => { reset(); setSceneError(false); setSceneVersion(version => version + 1) }}>重試</button></div>}
      </div>
      <div className="cola-console">
        <div className="cola-feedback">
          <div className="cola-pressure-label"><label htmlFor="cola-pressure">氣泡壓力</label><span>{reading.pressure}%</span></div>
          <progress id="cola-pressure" max="100" value={reading.pressure} />
          <p aria-live="polite">{hint}</p>
        </div>
        <div className="cola-actions">
          {preLaunch && <button className="cola-open" type="button" {...pressProps} disabled={sceneError}>
            <span style={{ inlineSize: `${reading.lid}%` }} aria-hidden="true" />按住開蓋
          </button>}
          {reading.phase === 'result' && <button className="cola-open" type="button" onClick={reset}>再搖一瓶</button>}
          {reading.phase === 'opening' && <button className="cola-secondary" type="button" onClick={reset}>換一瓶</button>}
          {reading.phase === 'result' && !result && <button className="cola-secondary" type="button" onClick={() => setResult(true)}>查看本局結果</button>}
          {active && touchDevice && <button className="cola-secondary" type="button" onClick={() => { void enableMotion() }} aria-pressed={motion === 'pending' || motion === 'active'}>
            {motion === 'active' ? '停用實體搖晃' : motion === 'pending' ? '正在偵測實體搖晃' : '啟用實體搖晃'}
          </button>}
          {active && <button className="cola-secondary" type="button" disabled={sceneError} onClick={() => {
            audio.current?.unlock()
            shake(round.current.swing > 0 ? -1 : 1)
          }}>點按搖晃</button>}
          <button className="cola-secondary" type="button" disabled={!globalSettings.soundEnabled} aria-pressed={globalSettings.soundEnabled && heard}
            onClick={() => { audio.current?.setEnabled(!heard && globalSettings.soundEnabled); setHeard(!heard); if (!heard) audio.current?.unlock() }}>音效</button>
        </div>
        {motion === 'unavailable' && active && <p className="cola-motion-note" role="status">目前收不到動作感測資料。可以直接拖曳瓶身或點按搖晃。</p>}
      </div>
      <div className="cola-footer">
        <a href={`${import.meta.env.BASE_URL}cola-shake/credits.md`}>音效來源</a>
        <p className="cola-best">個人最佳 <strong>{highScore} cm</strong></p>
      </div>
      {result && <OverlayDialog label="本局結果" onClose={() => setResult(false)}>
        <p className="eyebrow">最遠落點</p><h2 className="cola-result-distance">{reading.distance} <small>cm</small></h2>
        <button type="button" className="primary-button" onClick={reset}>再搖一瓶</button>
        <LeaderboardPanel board="cola-distance" score={reading.distance} />
      </OverlayDialog>}
      {board && <LeaderboardDialog initialBoard="cola-distance" onClose={() => setBoard(false)} />}
    </section>
  )
}
