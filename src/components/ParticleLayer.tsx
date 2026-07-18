import { Fragment, useEffect, useRef, useState, type CSSProperties } from 'react'
import { getExplosionTierConfig, getParticleKind, type ExplosionGeometry, type ExplosionParticleKind } from '../game/explosion'
import type { ComboClearEffect, EffectLevel } from '../game/comboEffects'
import { getDeviceEffectScale, MAX_ACTIVE_BURSTS, MAX_PARTICLES } from '../game/effectPerformance'

type PositionedEffect = ComboClearEffect & ExplosionGeometry & { particleCount: number }
type ParticleLayerProps = { effect: (ComboClearEffect & ExplosionGeometry) | null; level: EffectLevel }

function particleStyle(index: number, count: number, kind: ExplosionParticleKind, radius: number): CSSProperties {
  const angle = (index / Math.max(1, count)) * Math.PI * 2 + (index % 3) * 0.14
  const distance = (24 + (index % 4) * 8) * radius
  return {
    '--particle-x': `${Math.cos(angle) * distance}px`,
    '--particle-y': `${Math.sin(angle) * distance}px`,
    '--particle-delay': `${(index % 5) * 12}ms`,
    '--particle-turn': `${index % 2 === 0 ? 110 : -110}deg`,
    '--particle-scale': kind === 'rind' ? 1.25 : kind === 'seed' ? 0.7 : 1,
  } as CSSProperties
}

function resolveParticleCount(effect: ComboClearEffect, level: EffectLevel): number {
  if (level === 'off') return 0
  const intensity = level === 'full' ? effect.particleScale : level === 'reduced' ? effect.particleScale * 0.55 : 0.36
  const scaled = Math.round(getExplosionTierConfig(effect.tier).particleCount * intensity * getDeviceEffectScale())
  return Math.min(MAX_PARTICLES, Math.max(level === 'minimal' ? 2 : 1, scaled))
}

export function ParticleLayer({ effect, level }: ParticleLayerProps) {
  const [bursts, setBursts] = useState<PositionedEffect[]>([])
  const timers = useRef(new Map<number, number>())
  const lastHandledEffectId = useRef<number | null>(null)

  const clearBursts = (): void => {
    timers.current.forEach((timer) => window.clearTimeout(timer))
    timers.current.clear()
    setBursts([])
  }

  useEffect(() => () => {
    timers.current.forEach((timer) => window.clearTimeout(timer))
    timers.current.clear()
  }, [])

  useEffect(() => {
    if (level === 'off') {
      clearBursts()
      return undefined
    }
    if (!effect) {
      clearBursts()
      return undefined
    }
    if (lastHandledEffectId.current === effect.id) return undefined
    lastHandledEffectId.current = effect.id
    const particleCount = resolveParticleCount(effect, level)
    const next = { ...effect, particleCount }
    setBursts((current) => {
      if (current.some(({ id }) => id === effect.id)) return current
      const retained = current.slice(-(MAX_ACTIVE_BURSTS - 1))
      while (retained.reduce((sum, burst) => sum + burst.particleCount, 0) + particleCount > MAX_PARTICLES && retained.length > 0) retained.shift()
      return [...retained, next]
    })
    const existingTimer = timers.current.get(effect.id)
    if (existingTimer !== undefined) window.clearTimeout(existingTimer)
    const timer = window.setTimeout(() => {
      timers.current.delete(effect.id)
      setBursts((current) => current.filter(({ id }) => id !== effect.id))
    }, effect.durationMs + 80)
    timers.current.set(effect.id, timer)
    return undefined
  }, [effect, level])

  if (bursts.length === 0) return null
  return <div className={`particle-layer effects-${level}`} aria-hidden="true" data-active-bursts={bursts.length}>
    {bursts.map((burst) => {
      const config = getExplosionTierConfig(burst.tier)
      const burstStyle = { '--burst-scale': burst.burstScale, '--burst-duration': `${burst.durationMs}ms` } as CSSProperties
      return <Fragment key={burst.id}>
        <div className={`combo-burst tier-${burst.tier}`}
          style={{ left: `${burst.center.x}%`, top: `${burst.center.y}%`, ...burstStyle } as CSSProperties}
        >
        {level !== 'minimal' ? <span className="harvest-core" /> : null}
        {level !== 'minimal' ? <span className="combo-ring" /> : null}
        {level === 'full' && config.hasSecondRing ? <span className="combo-ring combo-ring-secondary" /> : null}
        <b className="score-pop">+{burst.points}</b>
        {level === 'full' && config.hasFramePulse ? <span className="board-burst" /> : null}
        </div>
        {Array.from({ length: burst.particleCount }, (_, index) => {
          const source = burst.sources[index % burst.sources.length]!
          const kind = getParticleKind(index, burst.tier)
          return <i className={`fruit-particle particle-${kind}`} key={index}
            style={{ left: `${source.x}%`, top: `${source.y}%`, ...burstStyle, ...particleStyle(index, burst.particleCount, kind, config.radius) } as CSSProperties}
          />
        })}
      </Fragment>
    })}
  </div>
}
