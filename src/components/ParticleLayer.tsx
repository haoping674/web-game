import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { ComboClearEffect, EffectLevel } from '../game/comboEffects'
import { getExplosionTierConfig } from '../game/explosion'
import { createFruitParticles, PARTICLE_BUDGET, type ParticleInstance } from '../game/fruitParticles'
import { getDeviceEffectScale, MAX_ACTIVE_BURSTS } from '../game/effectPerformance'

type ParticleLayerProps = { effect: ComboClearEffect | null; level: EffectLevel }
type ActiveBurst = { id: number; centerX: number; centerY: number; points: number; tier: ComboClearEffect['tier']; durationMs: number; burstScale: number; startedAt: number }

function drawParticle(context: CanvasRenderingContext2D, particle: ParticleInstance): void {
  const progress = Math.min(1, particle.age / particle.lifetime)
  const scale = 1 - progress * 0.48
  context.save()
  context.translate(particle.x, particle.y)
  context.rotate(particle.rotation)
  context.globalAlpha = Math.max(0, 1 - progress * progress)
  context.fillStyle = particle.color
  context.strokeStyle = particle.color
  context.lineWidth = Math.max(1, particle.size * 0.28)
  context.scale(scale, scale)
  switch (particle.shape) {
    case 'circle':
      context.beginPath(); context.arc(0, 0, particle.size, 0, Math.PI * 2); context.fill(); break
    case 'droplet':
      context.beginPath(); context.moveTo(0, -particle.size * 1.5); context.bezierCurveTo(particle.size, -particle.size * 0.35, particle.size, particle.size, 0, particle.size); context.bezierCurveTo(-particle.size, particle.size, -particle.size, -particle.size * 0.35, 0, -particle.size * 1.5); context.fill(); break
    case 'seed':
      context.beginPath(); context.ellipse(0, 0, particle.size * 0.48, particle.size * 1.05, 0, 0, Math.PI * 2); context.fill(); break
    case 'leaf':
      context.beginPath(); context.moveTo(-particle.size, 0); context.quadraticCurveTo(0, -particle.size, particle.size, 0); context.quadraticCurveTo(0, particle.size, -particle.size, 0); context.fill(); break
    case 'peel':
      context.beginPath(); context.arc(0, 0, particle.size, -Math.PI * 0.85, Math.PI * 0.25); context.stroke(); break
    case 'spark':
      context.beginPath(); context.moveTo(-particle.size, 0); context.lineTo(particle.size, 0); context.moveTo(0, -particle.size); context.lineTo(0, particle.size); context.stroke(); break
  }
  context.restore()
}

function getCenter(effect: ComboClearEffect): { x: number; y: number } {
  if (effect.fruitEvent.fruits.length === 0) return { x: 50, y: 50 }
  const total = effect.fruitEvent.fruits.reduce((sum, fruit) => ({ x: sum.x + fruit.centerX, y: sum.y + fruit.centerY }), { x: 0, y: 0 })
  return { x: total.x / effect.fruitEvent.fruits.length, y: total.y / effect.fruitEvent.fruits.length }
}

/** A single, board-local canvas driven by one requestAnimationFrame loop. */
export function ParticleLayer({ effect, level }: ParticleLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<ParticleInstance[]>([])
  const frameRef = useRef<number | null>(null)
  const previousTimeRef = useRef<number | null>(null)
  const burstsRef = useRef<ActiveBurst[]>([])
  const lastEffectIdRef = useRef<number | null>(null)
  const ensureFrameRef = useRef<() => void>(() => undefined)
  const [bursts, setBursts] = useState<ActiveBurst[]>([])
  const [activeCount, setActiveCount] = useState(0)

  const syncCanvasSize = (): void => {
    const canvas = canvasRef.current
    const host = canvas?.parentElement
    if (!canvas || !host) return
    const bounds = host.getBoundingClientRect()
    const ratio = Math.min(2, window.devicePixelRatio || 1)
    const width = Math.max(1, Math.round(bounds.width * ratio))
    const height = Math.max(1, Math.round(bounds.height * ratio))
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
      canvas.style.width = `${bounds.width}px`
      canvas.style.height = `${bounds.height}px`
    }
  }

  const stopFrame = (): void => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    previousTimeRef.current = null
  }

  const clear = (): void => {
    particlesRef.current = []
    burstsRef.current = []
    setBursts([])
    setActiveCount(0)
    stopFrame()
    const context = canvasRef.current?.getContext('2d')
    if (context && canvasRef.current) context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
  }

  const draw = (now: number): void => {
    frameRef.current = null
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context || document.hidden) return
    const elapsed = Math.min(34, Math.max(0, now - (previousTimeRef.current ?? now)))
    previousTimeRef.current = now
    const deltaSeconds = elapsed / 1_000
    const ratio = Math.min(2, window.devicePixelRatio || 1)
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    context.clearRect(0, 0, canvas.width / ratio, canvas.height / ratio)
    const remaining = particlesRef.current.filter((particle) => {
      particle.age += elapsed
      if (particle.age >= particle.lifetime) return false
      particle.velocityX *= Math.pow(particle.drag, elapsed / 16.67)
      particle.velocityY = particle.velocityY * Math.pow(particle.drag, elapsed / 16.67) + particle.gravity * deltaSeconds
      particle.x += particle.velocityX * deltaSeconds
      particle.y += particle.velocityY * deltaSeconds
      particle.rotation += particle.rotationSpeed * deltaSeconds
      drawParticle(context, particle)
      return true
    })
    particlesRef.current = remaining
    const visibleBursts = burstsRef.current.filter((burst) => now - burst.startedAt <= burst.durationMs + 80)
    if (visibleBursts.length !== burstsRef.current.length) {
      burstsRef.current = visibleBursts
      setBursts(visibleBursts)
    }
    if (remaining.length === 0 && visibleBursts.length === 0) {
      setActiveCount(0)
      previousTimeRef.current = null
      return
    }
    setActiveCount((current) => current === remaining.length ? current : remaining.length)
    frameRef.current = window.requestAnimationFrame(draw)
  }

  const ensureFrame = (): void => {
    if (frameRef.current === null && !document.hidden) frameRef.current = window.requestAnimationFrame(draw)
  }
  ensureFrameRef.current = ensureFrame

  useEffect(() => {
    syncCanvasSize()
    const host = canvasRef.current?.parentElement
    const resize = () => syncCanvasSize()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize)
    if (host) observer?.observe(host)
    window.addEventListener('resize', resize)
    const onVisibilityChange = () => {
      if (document.hidden) stopFrame()
      else if (particlesRef.current.length > 0 || burstsRef.current.length > 0) ensureFrameRef.current()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      stopFrame()
    }
  }, [])

  useEffect(() => {
    if (level === 'off' || effect === null) {
      clear()
      return
    }
    if (lastEffectIdRef.current === effect.id) return
    lastEffectIdRef.current = effect.id
    try {
      // The canvas is mounted only when the first burst arrives, so size it
      // here as well as in the long-lived resize observer effect.
      syncCanvasSize()
      const created = createFruitParticles(effect.fruitEvent, level, getDeviceEffectScale())
      const available = Math.max(0, PARTICLE_BUDGET.maxActive - particlesRef.current.length)
      particlesRef.current = [...particlesRef.current, ...created.slice(0, available)]
      const center = getCenter(effect)
      const nextBurst: ActiveBurst = { id: effect.id, centerX: center.x, centerY: center.y, points: effect.points, tier: effect.tier, durationMs: effect.durationMs, burstScale: effect.burstScale, startedAt: performance.now() }
      burstsRef.current = [...burstsRef.current.slice(-(MAX_ACTIVE_BURSTS - 1)), nextBurst]
      setBursts(burstsRef.current)
      setActiveCount(particlesRef.current.length)
      ensureFrameRef.current()
    } catch {
      // Visual feedback is intentionally non-critical: scoring and removal continue.
    }
  }, [effect, level])

  if (effect === null && bursts.length === 0 && activeCount === 0) return null

  return <div className={`particle-layer effects-${level}`} aria-hidden="true" data-active-particles={activeCount} data-active-bursts={bursts.length}>
    <canvas ref={canvasRef} className="fruit-particle-canvas" />
    {bursts.map((burst) => {
      const config = getExplosionTierConfig(burst.tier)
      const style = { left: `${burst.centerX}px`, top: `${burst.centerY}px`, '--burst-scale': burst.burstScale, '--burst-duration': `${burst.durationMs}ms` } as CSSProperties
      return <div className={`combo-burst tier-${burst.tier}`} style={style} key={burst.id}>
        {level !== 'minimal' ? <span className="harvest-core" /> : null}
        {level !== 'minimal' ? <span className="combo-ring" /> : null}
        {level === 'full' && config.hasSecondRing ? <span className="combo-ring combo-ring-secondary" /> : null}
        <b className="score-pop">+{burst.points}</b>
        {level === 'full' && config.hasFramePulse ? <span className="board-burst" /> : null}
      </div>
    })}
  </div>
}
