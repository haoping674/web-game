import { useEffect, useState, type CSSProperties } from 'react'
import { getComboWindowMs } from '../game/comboConfig'
import { getComboRemainingMs } from '../game/comboTimer'
import { getComboTier, getComboTitle, isComboMilestone } from '../game/comboTier'
import type { PlayableMode } from '../game/modes'
import type { GameStatus } from '../game/types'

type ComboIndicatorProps = {
  combo: number
  bestCombo: number
  comboDeadline: number | null
  status: GameStatus
  mode: PlayableMode
}

export function ComboIndicator({ combo, bestCombo, comboDeadline, status, mode }: ComboIndicatorProps) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    setNow(Date.now())
    if (combo === 0 || comboDeadline === null || status !== 'playing') return undefined
    const timer = window.setInterval(() => setNow(Date.now()), 100)
    return () => window.clearInterval(timer)
  }, [combo, comboDeadline, status])

  const tier = getComboTier(combo)
  const title = getComboTitle(combo)
  const remaining = getComboRemainingMs({ comboDeadline, status }, now)
  const duration = getComboWindowMs(mode, Math.max(1, combo))
  const progress = combo > 0 ? Math.min(100, (remaining / duration) * 100) : 0
  return <div className={`hud-combo tier-${tier}${isComboMilestone(combo) ? ' is-milestone' : ''}`} data-combo-tier={tier}>
    <span>Combo</span>
    <strong key={combo}>{combo} <small>最高 {bestCombo}</small></strong>
    {title ? <em key={`${title}-${combo}`}>{title}</em> : null}
    <i className={combo > 0 ? '' : 'is-idle'} style={{ '--combo-progress': `${progress}%` } as CSSProperties} aria-label={combo > 0 ? 'Combo 剩餘時間' : undefined} aria-hidden={combo === 0} />
  </div>
}
