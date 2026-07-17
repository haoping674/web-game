import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
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
  const departureTimer = useRef<number | null>(null)
  const [departingValue, setDepartingValue] = useState<CellValue>(null)

  useLayoutEffect(() => {
    if (value !== null) {
      previous.current = value
      if (departureTimer.current !== null) window.clearTimeout(departureTimer.current)
      departureTimer.current = null
      setDepartingValue(null)
      return
    }

    if (!animationsEnabled) {
      previous.current = null
      if (departureTimer.current !== null) window.clearTimeout(departureTimer.current)
      departureTimer.current = null
      setDepartingValue(null)
      return
    }

    if (clearEffectId === undefined || previous.current === null) return
    const nextDepartingValue = previous.current
    // Consume the old value immediately. Later Combo effects must never be
    // able to replay a fruit that has already completed its clear animation.
    previous.current = null
    if (departureTimer.current !== null) window.clearTimeout(departureTimer.current)
    setDepartingValue(nextDepartingValue)
    departureTimer.current = window.setTimeout(() => {
      departureTimer.current = null
      setDepartingValue(null)
    }, clearDurationMs)
  }, [animationsEnabled, clearDurationMs, clearEffectId, value])

  useEffect(() => () => {
    if (departureTimer.current !== null) window.clearTimeout(departureTimer.current)
  }, [])

  const leaving = value === null && departingValue !== null
  const displayValue = value ?? departingValue
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
