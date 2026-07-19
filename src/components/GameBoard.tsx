import { useCallback, useEffect, useRef, useState } from 'react'
import { BOARD_COLUMNS, BOARD_ROWS, TARGET_SUM } from '../game/constants'
import type { ComboClearEffect, EffectLevel } from '../game/comboEffects'
import { getRectangleCells, isPointInRect, normalizeRect, sumSelection } from '../game/selectionCalculator'
import type { CellValue, GridPoint, GridRect } from '../game/types'
import { getFruitTheme, type FruitParticleOrigin } from '../game/fruitParticles'
import { FruitCell } from './FruitCell'
import { ParticleLayer } from './ParticleLayer'

type GameBoardProps = {
  board: CellValue[][]
  onSelectionEnd?: (rect: GridRect, sum: number, fruits?: readonly FruitParticleOrigin[]) => void
  disabled?: boolean
  hint?: GridRect | null
  clearEffect?: ComboClearEffect | null
  effectLevel?: EffectLevel
}

type BoardPoint = { point: GridPoint; inside: boolean }

function usePortraitBoard() {
  const query = '(max-width: 560px) and (orientation: portrait)'
  const [isPortrait, setIsPortrait] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const media = window.matchMedia(query)
    const update = () => setIsPortrait(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return isPortrait
}

export function GameBoard({ board, onSelectionEnd, disabled = false, hint = null, clearEffect = null, effectLevel = 'full' }: GameBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<number | null>(null)
  const invalidTimerRef = useRef<number | null>(null)
  const activePointerIdRef = useRef<number | null>(null)
  const activeTouchPointersRef = useRef(new Set<number>())
  const multiPointerBlockedRef = useRef(false)
  const pendingPoint = useRef<GridPoint | null>(null)
  const lastBoardPointRef = useRef<GridPoint | null>(null)
  const isPortrait = usePortraitBoard()
  const [selection, setSelection] = useState<GridRect | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [multiPointerBlocked, setMultiPointerBlocked] = useState(false)
  const [invalid, setInvalid] = useState(false)
  const [invalidRect, setInvalidRect] = useState<GridRect | null>(null)
  const [keyboardPoint, setKeyboardPoint] = useState<GridPoint>({ row: 0, column: 0 })
  const [keyboardStart, setKeyboardStart] = useState<GridPoint | null>(null)

  const cancelFrame = useCallback(() => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    pendingPoint.current = null
  }, [])

  const releaseActivePointer = useCallback(() => {
    const boardElement = boardRef.current
    const pointerId = activePointerIdRef.current
    activePointerIdRef.current = null
    if (!boardElement || pointerId === null || typeof boardElement.hasPointerCapture !== 'function') return
    try {
      if (boardElement.hasPointerCapture(pointerId)) boardElement.releasePointerCapture(pointerId)
    } catch { /* capture may already have been released by pointercancel */ }
  }, [])

  const cancelActiveSelection = useCallback(() => {
    cancelFrame()
    releaseActivePointer()
    if (invalidTimerRef.current !== null) window.clearTimeout(invalidTimerRef.current)
    invalidTimerRef.current = null
    setSelection(null)
    setIsDragging(false)
    setInvalid(false)
    setInvalidRect(null)
    setKeyboardStart(null)
  }, [cancelFrame, releaseActivePointer])

  const endMultiPointerBlockIfIdle = useCallback(() => {
    if (activeTouchPointersRef.current.size !== 0) return
    multiPointerBlockedRef.current = false
    setMultiPointerBlocked(false)
  }, [])

  const beginMultiPointerBlock = useCallback(() => {
    multiPointerBlockedRef.current = true
    setMultiPointerBlocked(true)
    cancelActiveSelection()
  }, [cancelActiveSelection])

  useEffect(() => {
    if (disabled) cancelActiveSelection()
  }, [cancelActiveSelection, disabled])

  useEffect(() => () => {
    cancelFrame()
    releaseActivePointer()
    if (invalidTimerRef.current !== null) window.clearTimeout(invalidTimerRef.current)
  }, [cancelFrame, releaseActivePointer])

  useEffect(() => {
    if (!multiPointerBlocked) return undefined
    const releaseTouch = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return
      activeTouchPointersRef.current.delete(event.pointerId)
      endMultiPointerBlockIfIdle()
    }
    window.addEventListener('pointerup', releaseTouch)
    window.addEventListener('pointercancel', releaseTouch)
    return () => {
      window.removeEventListener('pointerup', releaseTouch)
      window.removeEventListener('pointercancel', releaseTouch)
    }
  }, [endMultiPointerBlockIfIdle, multiPointerBlocked])

  const pointFromCoordinates = (clientX: number, clientY: number): BoardPoint | null => {
    const bounds = boardRef.current?.getBoundingClientRect()
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return null
    const visualColumnCount = isPortrait ? BOARD_ROWS : BOARD_COLUMNS
    const visualRowCount = isPortrait ? BOARD_COLUMNS : BOARD_ROWS
    const relativeX = clientX - bounds.left
    const relativeY = clientY - bounds.top
    const inside = relativeX >= 0 && relativeY >= 0 && relativeX <= bounds.width && relativeY <= bounds.height
    const visualColumn = Math.min(visualColumnCount - 1, Math.max(0, Math.floor((relativeX / bounds.width) * visualColumnCount)))
    const visualRow = Math.min(visualRowCount - 1, Math.max(0, Math.floor((relativeY / bounds.height) * visualRowCount)))
    return { point: isPortrait ? { row: visualColumn, column: visualRow } : { row: visualRow, column: visualColumn }, inside }
  }

  const captureFruitOrigins = (rect: GridRect): FruitParticleOrigin[] => {
    const boardElement = boardRef.current
    if (!boardElement) return []
    const cells = getRectangleCells(rect).filter(({ row, column }) => board[row]?.[column] !== null)
    // Read board and fruit rectangles together, before the reducer clears their values.
    const boardBounds = boardElement.getBoundingClientRect()
    return cells.flatMap(({ row, column }) => {
      const id = `${row}-${column}`
      const element = boardElement.querySelector<HTMLElement>(`[data-fruit-id="${id}"]`)
      if (!element) return []
      const bounds = element.getBoundingClientRect()
      if (bounds.width <= 0 || bounds.height <= 0) return []
      return [{ id, type: getFruitTheme(row * BOARD_COLUMNS + column), centerX: bounds.left - boardBounds.left + bounds.width / 2, centerY: bounds.top - boardBounds.top + bounds.height / 2, width: bounds.width, height: bounds.height }]
    })
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return
    if (event.pointerType === 'touch') {
      activeTouchPointersRef.current.add(event.pointerId)
      if (multiPointerBlockedRef.current || activeTouchPointersRef.current.size > 1) {
        beginMultiPointerBlock()
        return
      }
    }
    if (multiPointerBlockedRef.current || activePointerIdRef.current !== null) return
    const boardPoint = pointFromCoordinates(event.clientX, event.clientY)
    if (!boardPoint?.inside) return
    if (event.cancelable) event.preventDefault()
    try {
      if (typeof event.currentTarget.setPointerCapture === 'function') event.currentTarget.setPointerCapture(event.pointerId)
    } catch { /* pointer capture is an enhancement, not a requirement */ }
    activePointerIdRef.current = event.pointerId
    lastBoardPointRef.current = boardPoint.point
    setKeyboardStart(null)
    setKeyboardPoint(boardPoint.point)
    setSelection({ start: boardPoint.point, end: boardPoint.point })
    setIsDragging(true)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || multiPointerBlockedRef.current || !isDragging || event.pointerId !== activePointerIdRef.current) return
    if (event.cancelable) event.preventDefault()
    const boardPoint = pointFromCoordinates(event.clientX, event.clientY)
    if (!boardPoint?.inside) return
    lastBoardPointRef.current = boardPoint.point
    pendingPoint.current = boardPoint.point
    if (frameRef.current !== null) return
    frameRef.current = window.requestAnimationFrame(() => {
      const point = pendingPoint.current
      if (point) setSelection((current) => (current ? { ...current, end: point } : current))
      frameRef.current = null
    })
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') activeTouchPointersRef.current.delete(event.pointerId)
    if (multiPointerBlockedRef.current) {
      endMultiPointerBlockIfIdle()
      return
    }
    if (event.pointerId !== activePointerIdRef.current || !isDragging || !selection || disabled) return
    if (event.cancelable) event.preventDefault()
    const boardPoint = pointFromCoordinates(event.clientX, event.clientY)
    const endPoint = boardPoint?.inside ? boardPoint.point : lastBoardPointRef.current
    if (!endPoint) {
      cancelActiveSelection()
      return
    }
    lastBoardPointRef.current = endPoint
    cancelFrame()
    releaseActivePointer()
    const completed = normalizeRect({ ...selection, end: endPoint })
    const sum = sumSelection(board, completed)
    if (sum !== TARGET_SUM) {
      if (invalidTimerRef.current !== null) window.clearTimeout(invalidTimerRef.current)
      setInvalid(true)
      setInvalidRect(completed)
      invalidTimerRef.current = window.setTimeout(() => {
        setInvalid(false)
        setInvalidRect(null)
        invalidTimerRef.current = null
      }, 260)
    }
    const fruits = sum === TARGET_SUM ? captureFruitOrigins(completed) : []
    if (fruits.length > 0) onSelectionEnd?.(completed, sum, fruits)
    else onSelectionEnd?.(completed, sum)
    setIsDragging(false)
    setSelection(null)
  }

  const handlePointerCancel = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') activeTouchPointersRef.current.delete(event.pointerId)
    if (event.pointerId === activePointerIdRef.current || multiPointerBlockedRef.current) cancelActiveSelection()
    endMultiPointerBlockIfIdle()
  }

  const activeSelection = selection
    ? normalizeRect(selection)
    : invalidRect ?? (keyboardStart ? normalizeRect({ start: keyboardStart, end: keyboardPoint }) : hint)
  const currentSum = activeSelection ? sumSelection(board, activeSelection) : 0
  const selectedCount = activeSelection ? getRectangleCells(activeSelection).filter(({ row, column }) => board[row]?.[column] !== null).length : 0
  const selectionState = currentSum === TARGET_SUM ? 'is-success' : currentSum > TARGET_SUM ? 'is-over' : ''
  const feedback = currentSum === TARGET_SUM ? '剛好 10，可以消除！' : currentSum > TARGET_SUM ? `${currentSum} / 10，超過 ${currentSum - TARGET_SUM}` : `${currentSum} / 10，還差 ${TARGET_SUM - currentSum}`
  const overlayStyle = activeSelection
    ? isPortrait
      ? { gridColumn: `${activeSelection.start.row + 1} / ${activeSelection.end.row + 2}`, gridRow: `${activeSelection.start.column + 1} / ${activeSelection.end.column + 2}` }
      : { gridColumn: `${activeSelection.start.column + 1} / ${activeSelection.end.column + 2}`, gridRow: `${activeSelection.start.row + 1} / ${activeSelection.end.row + 2}` }
    : undefined
  const selectionSumStyle = activeSelection
    ? isPortrait
      ? { gridColumn: activeSelection.start.row + 1, gridRow: activeSelection.start.column + 1 }
      : { gridColumn: activeSelection.start.column + 1, gridRow: activeSelection.start.row + 1 }
    : undefined
  const cursorStyle = isPortrait
    ? { gridColumn: keyboardPoint.row + 1, gridRow: keyboardPoint.column + 1 }
    : { gridColumn: keyboardPoint.column + 1, gridRow: keyboardPoint.row + 1 }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled || multiPointerBlockedRef.current) return
    const movement: Record<string, GridPoint> = isPortrait
      ? { ArrowUp: { row: 0, column: -1 }, ArrowDown: { row: 0, column: 1 }, ArrowLeft: { row: -1, column: 0 }, ArrowRight: { row: 1, column: 0 } }
      : { ArrowUp: { row: -1, column: 0 }, ArrowDown: { row: 1, column: 0 }, ArrowLeft: { row: 0, column: -1 }, ArrowRight: { row: 0, column: 1 } }
    if (event.key in movement) {
      event.preventDefault()
      const delta = movement[event.key]!
      setKeyboardPoint((point) => ({
        row: Math.min(BOARD_ROWS - 1, Math.max(0, point.row + delta.row)),
        column: Math.min(BOARD_COLUMNS - 1, Math.max(0, point.column + delta.column)),
      }))
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (!keyboardStart) setKeyboardStart(keyboardPoint)
      else {
        const rect = normalizeRect({ start: keyboardStart, end: keyboardPoint })
        const sum = sumSelection(board, rect)
        const fruits = sum === TARGET_SUM ? captureFruitOrigins(rect) : []
        if (fruits.length > 0) onSelectionEnd?.(rect, sum, fruits)
        else onSelectionEnd?.(rect, sum)
        setKeyboardStart(null)
      }
    } else if (event.key === 'Escape') {
      setKeyboardStart(null)
    }
  }

  return (
    <div className={`board-frame${multiPointerBlocked ? ' is-multi-pointer' : ''}`}>
      <div
        ref={boardRef}
        className={`game-board${isPortrait ? ' is-portrait' : ''}`}
        style={{ gridTemplateColumns: `repeat(${isPortrait ? BOARD_ROWS : BOARD_COLUMNS}, 1fr)` }}
        role="grid"
        tabIndex={disabled ? -1 : 0}
        aria-label="水果數字棋盤"
        aria-description="棋盤內單指框選；第二根手指加入會取消選取。鍵盤可按 Enter 設定矩形兩端。"
        aria-disabled={disabled}
        data-multi-pointer-blocked={multiPointerBlocked || undefined}
        onContextMenu={(event) => event.preventDefault()}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onLostPointerCapture={(event) => {
          if (event.pointerId === activePointerIdRef.current && !multiPointerBlockedRef.current) cancelActiveSelection()
        }}
      >
        {board.flatMap((row, rowIndex) => row.map((value, columnIndex) => {
          const point = { row: rowIndex, column: columnIndex }
          const isClearedCell = clearEffect ? isPointInRect(point, clearEffect.rect) && value === null : false
          return <FruitCell
            key={`${rowIndex}-${columnIndex}`}
            value={value}
            index={rowIndex * BOARD_COLUMNS + columnIndex}
            fruitId={`${rowIndex}-${columnIndex}`}
            highlighted={activeSelection ? isPointInRect(point, activeSelection) : false}
            animationsEnabled={effectLevel !== 'off'}
            clearEffectId={isClearedCell ? clearEffect?.id : undefined}
            clearTier={isClearedCell ? clearEffect?.tier : undefined}
            clearDurationMs={clearEffect?.durationMs}
            style={isPortrait ? { gridColumn: rowIndex + 1, gridRow: columnIndex + 1 } : undefined}
          />
        }))}
        {activeSelection ? <>
          <div className={`selection-overlay ${selectionState}${invalid ? ' is-invalid' : ''}${hint ? ' is-hint' : ''}`} style={overlayStyle} />
          <output className={`selection-sum ${selectionState}`} style={selectionSumStyle}>{feedback}<small>{selectedCount} 顆水果</small></output>
        </> : null}
        {!keyboardStart && !isDragging ? <div className="keyboard-cursor" style={cursorStyle} aria-hidden="true" /> : null}
        <ParticleLayer effect={clearEffect} level={effectLevel} />
      </div>
    </div>
  )
}
