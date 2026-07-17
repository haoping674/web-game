import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { ComboClearEffect, EffectLevel } from '../game/comboEffects'
import { getDeviceEffectScale, MAX_PARTICLES } from '../game/effectPerformance'

type EffectPosition = { x: number; y: number }
type PositionedEffect = ComboClearEffect & EffectPosition & { particleCount: number }
type ParticleLayerProps = { effect: (ComboClearEffect & EffectPosition) | null; level: EffectLevel }

const baseParticleCount = { base: 6, rising: 10, charged: 16, legendary: 22 } as const

function particleStyle(index: number, count: number): CSSProperties {
  const angle = (index / Math.max(1, count)) * Math.PI * 2 + (index % 3) * 0.14
  const distance = 24 + (index % 4) * 9
  return {
    '--particle-x': `${Math.cos(angle) * distance}px`,
    '--particle-y': `${Math.sin(angle) * distance}px`,
    '--particle-delay': `${(index % 5) * 16}ms`,
  } as CSSProperties
}

export function ParticleLayer({ effect, level }: ParticleLayerProps) {
  const [bursts, setBursts] = useState<PositionedEffect[]>([])
  const timers = useRef(new Map<number, number>())
  const lastHandledEffectId = useRef<number | null>(null)

  useEffect(() => () => {
    timers.current.forEach((timer) => window.clearTimeout(timer))
    timers.current.clear()
  }, [])

  useEffect(() => {
    if (!effect || lastHandledEffectId.current === effect.id) return undefined
    lastHandledEffectId.current = effect.id
    if (level === 'off') return undefined
    const intensityScale = level === 'full' ? effect.particleScale : level === 'reduced' ? effect.particleScale * 0.48 : 0
    const scale = intensityScale * getDeviceEffectScale()
    const particleCount = Math.min(MAX_PARTICLES, Math.round(baseParticleCount[effect.tier] * scale))
    const next = { ...effect, particleCount }
    setBursts((current) => {
      if (current.some(({ id }) => id === effect.id)) return current
      const retained = current.slice(-2)
      while (retained.reduce((sum, burst) => sum + burst.particleCount, 0) + particleCount > MAX_PARTICLES && retained.length > 0) retained.shift()
      return [...retained, next]
    })
    const existingTimer = timers.current.get(effect.id)
    if (existingTimer !== undefined) window.clearTimeout(existingTimer)
    const timer = window.setTimeout(() => {
      timers.current.delete(effect.id)
      setBursts((current) => current.filter(({ id }) => id !== effect.id))
    }, effect.durationMs + 180)
    timers.current.set(effect.id, timer)
    return undefined
  }, [effect, level])

  if (bursts.length === 0) return null
  return <div className={`particle-layer effects-${level}`} aria-hidden="true">
    {bursts.map((burst) => <div
      className={`combo-burst tier-${burst.tier}`}
      key={burst.id}
      style={{ left: `${burst.x}%`, top: `${burst.y}%`, '--burst-scale': burst.burstScale, '--burst-duration': `${burst.durationMs}ms` } as CSSProperties}
    >
      {level !== 'minimal' ? <span className="harvest-core" /> : null}
      {level !== 'minimal' && burst.tier !== 'base' ? <span className="combo-ring" /> : null}
      {Array.from({ length: burst.particleCount }, (_, index) => <i key={index} style={particleStyle(index, burst.particleCount)} />)}
      <b className="score-pop">+{burst.points}</b>
      {level !== 'minimal' && burst.tier === 'legendary' ? <span className="board-burst" /> : null}
    </div>)}
  </div>
}
