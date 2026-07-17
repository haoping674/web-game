import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { ComboTier } from '../game/comboTier'
import type { CellValue } from '../game/types'

type FruitCellProps = {
  value: CellValue
  index: number
  highlighted?: boolean
  clearEffectId?: number
  clearTier?: ComboTier
  clearDurationMs?: number
  animationsEnabled?: boolean
  style?: CSSProperties
}

export function FruitCell({ value, index, highlighted = false, clearEffectId, clearTier = 'base', clearDurationMs = 240, animationsEnabled = true, style }: FruitCellProps) {
  const previous = useRef<CellValue>(value)
  const [leaving, setLeaving] = useState(false)
  useEffect(() => {
    if (value === null && previous.current !== null) {
      setLeaving(animationsEnabled)
      const timer = window.setTimeout(() => setLeaving(false), clearDurationMs)
      return () => window.clearTimeout(timer)
    }
    previous.current = value
    return undefined
  }, [animationsEnabled, clearDurationMs, clearEffectId, value])
  const displayValue = value ?? (leaving ? previous.current : null)
  if (displayValue === null) return <div className="fruit-cell is-empty" style={style} aria-hidden="true" />
  const theme = index % 9
  const clearClass = leaving ? ` is-clearing tier-${clearTier}` : ''
  const cellStyle = { ...style, '--clear-delay': `${(index % 5) * 9}ms`, '--clear-duration': `${clearDurationMs}ms` } as CSSProperties
  return (
    <div className={`fruit-cell fruit-theme-${theme}${highlighted ? ' is-highlighted' : ''}${clearClass}`} style={cellStyle}>
      <span className="fruit-leaf" aria-hidden="true" />
      <span className="fruit-value">{displayValue}</span>
    </div>
  )
}
