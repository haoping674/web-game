import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'
import { OverlayDialog } from '../../components/OverlayDialog'
import { useGameActivity } from '../../hooks/useGameActivity'
import { useGamePauseShortcut } from '../../hooks/useGamePauseShortcut'
import { fixedClock } from '../../shared/immersive/fixedClock'
import { addPaperProgress, type GameProgress, type GlobalSettings } from '../../shared/storage/appStorage'
import { FLOOR, PaperPhysics } from './paperPhysics'
import { DEFAULT_TISSUE, HARD_BOXES, isSoftPack, SOFT_PACKS, TISSUE_BRANDS, type TissueBrand } from './tissueBox'
import { createTissueAudio } from './tissueAudio'
import { createTissueScene } from './tissueScene'
import './tissueRoll.css'

type Props = {
  globalSettings: GlobalSettings
  platformSettingsOpen: boolean
  progress: GameProgress
  onProgressChange: () => void
}

type Controls = { pull: (fast: boolean) => void; toss: () => void; changeBrand: (brand: TissueBrand) => void; clear: () => void; configure: () => void }

const easterEggs = [
  { sheets: 7, line: '第七張：今天的煩惱，也從盒裡抽走了。' },
  { sheets: 23, line: '面紙管理員來信：請繼續處理這起無事可做事件。' },
  { sheets: 64, line: '已達成紙屑山地形普查。研究經費：零元。' },
]

export default function TissueRollGame({ globalSettings, platformSettingsOpen, progress, onProgressChange }: Props) {
  const stage = useRef<HTMLDivElement>(null)
  const controls = useRef<Controls | null>(null)
  const [paused, setPaused] = useState(false)
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [generation, setGeneration] = useState(0)
  const [holding, setHolding] = useState(false)
  const [brand, setBrand] = useState<TissueBrand>(DEFAULT_TISSUE)
  const [active, setActive] = useState(false)
  const [notice, setNotice] = useState('')
  const [liveLength, setLiveLength] = useState(0)
  const pause = useCallback(() => setPaused(true), [])
  const blocked = paused || platformSettingsOpen
  useGamePauseShortcut({ isPlaying: !blocked && status === 'ready', onPause: pause })
  useGameActivity(active && !blocked && status === 'ready')

  const config = useEffectEvent(() => ({
    sound: globalSettings.soundEnabled, blocked,
    rumble: !globalSettings.reducedMotion && globalSettings.effectIntensity === 'full'
      && !matchMedia('(prefers-reduced-motion: reduce)').matches,
  }))
  const selectedBrand = useEffectEvent(() => brand)
  const save = useEffectEvent((millimeters: number, sheets: number, announce: boolean) => {
    const record = addPaperProgress(millimeters, sheets).games.tissueRoll
    onProgressChange()
    if (!announce) return
    const total = record.paperSheets ?? 0
    const distance = record.paperMillimeters ?? 0
    if (distance >= 4700 && distance - millimeters < 4700) setNotice('研究紀錄：這盒面紙似乎比看起來還深。')
    else if (sheets) setNotice(easterEggs.find((egg) => total >= egg.sheets && total - sheets < egg.sheets)?.line ?? `抽出 ${sheets} 張面紙。`)
  })

  useEffect(() => {
    const host = stage.current
    if (!host) return
    let uncommittedSheets = 0
    let committedLength = 0
    const initialBrand = selectedBrand()
    const audio = createTissueAudio()
    const physics: PaperPhysics = new PaperPhysics({
      draw: (strength, x, z) => {
        uncommittedSheets += 1
        audio.draw(strength, x, z)
        if (config().rumble && typeof navigator.vibrate === 'function') navigator.vibrate(Math.min(18, 7 + Math.round(strength * 2)))
      },
      impact: (strength, x, z, surface) => audio.impact(strength, x, z, surface, physics.boxMotion.soft),
      land: audio.land,
      brush: audio.brush,
    })
    physics.boxMotion.soft = isSoftPack(initialBrand)
    let scene: ReturnType<typeof createTissueScene>
    try {
      scene = createTissueScene(host, physics, initialBrand)
      scene.render(0)
    } catch (error) {
      console.warn('Tissue Roll 3D initialization failed', error)
      audio.dispose()
      setStatus('failed')
      return
    }

    let previous = 0
    let lastRefresh = 0
    let lastSave = 0
    let lastInput = -Infinity
    let lastDraw = -Infinity
    let frame = 0
    let pointer: number | null = null
    let paperTap: { x: number; y: number; time: number } | null = null
    let hidden = document.hidden
    let offscreen = false
    let failed = false
    let needsDraw = true
    let isActive = false
    let priorBoxX = physics.box.x
    let priorBoxZ = physics.box.z
    const clock = fixedClock((dt) => physics.step(dt))

    function flush(announce = true) {
      const distance = Math.round(physics.produced * 100)
      if (distance === committedLength && !uncommittedSheets) return
      save(distance - committedLength, uncommittedSheets, announce)
      committedLength = distance
      uncommittedSheets = 0
      if (announce) setLiveLength(0)
    }

    function release(fling = false) {
      const captured = pointer
      pointer = null
      paperTap = null
      physics.boxMotion.release(fling, performance.now())
      physics.release(fling)
      setHolding(false)
      if (captured !== null && host!.hasPointerCapture(captured)) host!.releasePointerCapture(captured)
    }

    function down(event: PointerEvent) {
      if (event.button !== 0 || !event.isPrimary || pointer !== null || config().blocked || failed) return
      const now = performance.now()
      audio.unlock()
      const grabbed = scene.grab(event.clientX, event.clientY, now)
      if (!grabbed) return
      const source = physics.grip?.point.position ?? physics.box
      audio.grab(grabbed === 'box' && physics.boxMotion.soft ? 'soft-pack' : grabbed, source.x, source.z)
      pointer = event.pointerId
      host!.setPointerCapture(pointer)
      if (grabbed === 'paper') paperTap = { x: event.clientX, y: event.clientY, time: now }
      setHolding(true)
      lastInput = now
    }

    function move(event: PointerEvent) {
      if (event.pointerId !== pointer) return
      if (paperTap && Math.hypot(event.clientX - paperTap.x, event.clientY - paperTap.y) > 5) paperTap = null
      lastInput = performance.now()
      scene.move(event.clientX, event.clientY, lastInput)
    }

    function up(event: PointerEvent) {
      if (event.pointerId !== pointer) return
      const completed = event.type === 'pointerup'
      lastInput = performance.now()
      const tap = completed && paperTap && !physics.grip?.piece && lastInput - paperTap.time < 400
        && Math.hypot(event.clientX - paperTap.x, event.clientY - paperTap.y) <= 5
      if (completed && !tap) scene.move(event.clientX, event.clientY, lastInput)
      if (completed && physics.grip?.piece) {
        const { x, z } = physics.grip.point.position
        audio.release(x, z)
      }
      release(completed && !tap)
      if (tap) physics.pull(false)
    }

    function visibility() {
      hidden = document.hidden
      previous = 0
      clock.reset()
      if (hidden) {
        flush()
        release()
      }
      audio.configure(config().sound, hidden || config().blocked || failed)
    }

    function contextLost(event: Event) {
      event.preventDefault()
      failed = true
      cancelAnimationFrame(frame)
      release()
      flush()
      audio.configure(false, true)
      setActive(false)
      setStatus('failed')
    }

    function tick(now: number) {
      frame = requestAnimationFrame(tick)
      const dt = previous ? (now - previous) / 1000 : 0
      previous = now
      const settings = config()
      const skipped = offscreen && pointer === null && now - lastInput > 2400
      if (hidden || settings.blocked || failed || skipped) {
        if (skipped) {
          clock.reset()
          if (isActive) {
            isActive = false
            setActive(false)
          }
        }
        audio.configure(settings.sound, true)
        return
      }
      audio.configure(settings.sound, false)
      clock.advance(dt)
      if (pointer !== null && !physics.grip && !physics.boxMotion.grabbed) release()
      const interacting = pointer !== null || now - lastInput < 2400 || physics.speed > 0.12
        || physics.boxMotion.moving || physics.offcuts.some((piece) => piece.awake > 0)
      if (interacting !== isActive) {
        isActive = interacting
        setActive(interacting)
      }
      const { grip, box } = physics
      const source = grip?.point.position ?? box
      const boxSlide = dt > 0 && box.lift < 0.035 && (physics.boxMotion.grabbed || physics.boxMotion.moving || physics.speed > 0.1)
        ? Math.hypot(box.x - priorBoxX, box.z - priorBoxZ) / dt : 0
      priorBoxX = box.x
      priorBoxZ = box.z
      const loose = grip?.piece
      audio.tick({
        feed: physics.speed,
        tension: physics.tension,
        film: physics.lipDeflection,
        x: source.x,
        z: source.z,
        loose: loose && grip ? grip.point.position.distanceTo(grip.point.previous) * 120 : 0,
        onDesk: !!loose && loose.bounds.min.y < FLOOR + 0.035,
        boxSlide,
        boxX: box.x,
        boxZ: box.z,
      })
      if (interacting || needsDraw || now - lastDraw >= 250) {
        scene.render(interacting ? Math.min(0.075, dt) : 0, settings.rumble)
        lastDraw = now
        needsDraw = false
      }
      if ((uncommittedSheets || now - lastSave > 1600) && !hidden) {
        lastSave = now
        flush()
      }
      if (now - lastRefresh > 125) {
        lastRefresh = now
        if (interacting) setLiveLength(Math.round(physics.produced * 100) - committedLength)
      }
    }

    controls.current = {
      pull(fast) {
        if (config().blocked || failed || pointer !== null) return
        audio.unlock()
        physics.pull(fast)
        lastInput = performance.now()
      },
      toss() {
        if (config().blocked || failed || pointer !== null) return
        audio.unlock()
        physics.release()
        physics.boxMotion.toss()
        lastInput = performance.now()
      },
      changeBrand(nextBrand) {
        if (config().blocked || failed) return
        release()
        flush()
        scene.changeBrand(nextBrand)
        physics.boxMotion.soft = isSoftPack(nextBrand)
        physics.replaceBox()
        setBrand(nextBrand)
        setNotice(`換上${TISSUE_BRANDS[nextBrand]}。`)
        needsDraw = true
      },
      clear() {
        if (config().blocked || failed) return
        if (physics.grip?.piece) release()
        const count = physics.offcuts.length
        if (count > 0) {
          let x = 0
          let z = 0
          for (const { bounds } of physics.offcuts) {
            x += (bounds.min.x + bounds.max.x) / 2
            z += (bounds.min.z + bounds.max.z) / 2
          }
          audio.unlock()
          audio.clear(count, x / count, z / count)
        }
        physics.offcuts = []
        needsDraw = true
        setNotice('桌面已清理。')
      },
      configure() {
        const settings = config()
        previous = 0
        clock.reset()
        if (settings.blocked) {
          release()
          flush()
        }
        audio.configure(settings.sound, hidden || settings.blocked || failed)
      },
    }
    setStatus('ready')
    controls.current.configure()
    host.addEventListener('pointerdown', down)
    host.addEventListener('pointermove', move)
    host.addEventListener('pointerup', up)
    host.addEventListener('pointercancel', up)
    host.addEventListener('lostpointercapture', up)
    scene.canvas.addEventListener('webglcontextlost', contextLost)
    document.addEventListener('visibilitychange', visibility)
    function visibilitySkipped(event: Event) {
      if ('skipped' in event) offscreen = event.skipped === true
    }
    let viewportObserver: IntersectionObserver | undefined
    if ('ContentVisibilityAutoStateChangeEvent' in window) {
      host.addEventListener('contentvisibilityautostatechange', visibilitySkipped)
    } else if (typeof IntersectionObserver === 'function') {
      viewportObserver = new IntersectionObserver(([entry]) => {
        offscreen = !entry?.isIntersecting
      }, { rootMargin: '120px' })
      viewportObserver.observe(host)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      flush(false)
      host.removeEventListener('pointerdown', down)
      host.removeEventListener('pointermove', move)
      host.removeEventListener('pointerup', up)
      host.removeEventListener('pointercancel', up)
      host.removeEventListener('lostpointercapture', up)
      scene.canvas.removeEventListener('webglcontextlost', contextLost)
      document.removeEventListener('visibilitychange', visibility)
      host.removeEventListener('contentvisibilityautostatechange', visibilitySkipped)
      viewportObserver?.disconnect()
      controls.current = null
      audio.dispose()
      scene.dispose()
    }
  }, [generation])

  useEffect(() => { controls.current?.configure() }, [blocked, globalSettings.soundEnabled])

  const meters = ((progress.paperMillimeters ?? 0) + liveLength) / 1000
  const disabled = status !== 'ready' || blocked
  const soft = isSoftPack(brand)

  return (
    <section className="tissue-game" aria-labelledby="tissue-title">
      <header className="tissue-heading">
        <div><p className="eyebrow">解解壓</p><h1 id="tissue-title">無限抽衛生紙</h1></div>
        <button type="button" className="tissue-button" disabled={disabled} onClick={pause}>暫停</button>
      </header>
      <div className="tissue-frame">
        <div ref={stage} className={`tissue-stage${holding ? ' is-holding' : ''}`} aria-label={`木桌上的${TISSUE_BRANDS[brand]}面紙`} role="img" />
        {status === 'loading' && <p className="tissue-message" role="status">正在準備面紙…</p>}
        {status === 'failed' && <div className="tissue-message" role="alert"><p>這個瀏覽器目前無法開啟 3D 場景。請確認 WebGL 2 可用。</p><button className="tissue-button" onClick={() => { setStatus('loading'); setGeneration((value) => value + 1) }}>重試</button></div>}
      </div>
      <div className="tissue-console">
        <div className="tissue-instructions"><p>點一下輕抽，按住可拉紙。桌上的紙和包裝也能拖動。</p><p className="tissue-record">累積抽出 <strong>{progress.paperSheets ?? 0} 張</strong><span aria-hidden="true"> · </span>拉出 <strong>{meters.toFixed(2)} 公尺</strong></p></div>
        <div className="tissue-tools" aria-label="衛生紙操作" role="group">
          <button type="button" className="tissue-button" disabled={disabled} onClick={() => controls.current?.pull(false)}>輕抽</button>
          <button type="button" className="tissue-button tissue-flick" disabled={disabled} onClick={() => controls.current?.pull(true)}>快抽</button>
          <button type="button" className="tissue-button" disabled={disabled} onClick={() => controls.current?.toss()}>{soft ? '丟軟包' : '丟紙盒'}</button>
          <button type="button" className="tissue-button tissue-clear" disabled={disabled} onClick={() => controls.current?.clear()}>清理桌面</button>
          <select className="tissue-button" aria-label="面紙包裝" disabled={disabled} value={brand} onChange={(event) => {
            const next = event.currentTarget.value
            if (Object.hasOwn(TISSUE_BRANDS, next)) controls.current?.changeBrand(next as TissueBrand)
          }}>
            <optgroup label="軟包">
              {Object.entries(SOFT_PACKS).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </optgroup>
            <optgroup label="硬盒">
              {Object.entries(HARD_BOXES).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </optgroup>
          </select>
        </div>
      </div>
      <p className="tissue-notice" aria-live="polite">{notice}</p>
      {paused && !platformSettingsOpen && (
        <OverlayDialog label="無限抽衛生紙已暫停" onClose={() => setPaused(false)}>
          <h2>先歇一下</h2>
          <p>面紙等你回來。</p>
          <div className="dialog-actions"><button type="button" className="primary-button" onClick={() => setPaused(false)}>繼續抽紙</button></div>
        </OverlayDialog>
      )}
    </section>
  )
}
