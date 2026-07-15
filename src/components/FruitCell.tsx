import { useEffect, useRef, useState } from 'react'
import type { CellValue } from '../game/types'

type FruitCellProps = {
  value: CellValue
  index: number
  highlighted?: boolean
  clearing?: boolean
  animationsEnabled?: boolean
}

export function FruitCell({ value, index, highlighted = false, clearing = false, animationsEnabled = true }: FruitCellProps) {
  const previous = useRef<CellValue>(value)
  const [leaving, setLeaving] = useState(false)
  useEffect(() => {
    if (value === null && previous.current !== null) {
      setLeaving(animationsEnabled)
      const timer = window.setTimeout(() => setLeaving(false), 240)
      return () => window.clearTimeout(timer)
    }
    previous.current = value
    return undefined
  }, [animationsEnabled, value])
  const displayValue = value ?? (leaving ? previous.current : null)
  if (displayValue === null) return <div className="fruit-cell is-empty" aria-hidden="true" />
  const theme = index % 9
  return (
    <div className={`fruit-cell fruit-theme-${theme}${highlighted ? ' is-highlighted' : ''}${clearing || leaving ? ' is-clearing' : ''}`}>
      <span className="fruit-leaf" aria-hidden="true" />
      <span className="fruit-value">{displayValue}</span>
    </div>
  )
}
