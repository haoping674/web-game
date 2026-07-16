import { useCallback, useEffect, useRef, useState } from 'react'
import { BOARD_COLUMNS, BOARD_ROWS, TARGET_SUM } from '../game/constants'
import { getRectangleCells, isPointInRect, normalizeRect, sumSelection } from '../game/selectionCalculator'
import type { CellValue, GridPoint, GridRect } from '../game/types'
import { FruitCell } from './FruitCell'

type GameBoardProps = {
  board: CellValue[][]
  onSelectionEnd?: (rect: GridRect, sum: number) => void
  disabled?: boolean
  hint?: GridRect | null
  animationsEnabled?: boolean
}

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

export function GameBoard({ board, onSelectionEnd, disabled = false, hint = null, animationsEnabled = true }: GameBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<number | null>(null)
  const invalidTimerRef = useRef<number | null>(null)
  const activePointerIdRef = useRef<number | null>(null)
  const pendingPoint = useRef<GridPoint | null>(null)
  const isPortrait = usePortraitBoard()
  const [selection, setSelection] = useState<GridRect | null>(null)
  const [isDragging, setIsDragging] = useState(false)
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
    if (boardElement && pointerId !== null && typeof boardElement.hasPointerCapture === 'function' && boardElement.hasPointerCapture(pointerId)) {
      boardElement.releasePointerCapture(pointerId)
    }
    activePointerIdRef.current = null
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

  useEffect(() => {
    if (disabled) cancelActiveSelection()
  }, [cancelActiveSelection, disabled])

  useEffect(() => () => {
    cancelFrame()
    releaseActivePointer()
    if (invalidTimerRef.current !== null) window.clearTimeout(invalidTimerRef.current)
  }, [cancelFrame, releaseActivePointer])

  const pointFromEvent = (event: React.PointerEvent<HTMLDivElement>): GridPoint | null => {
    const bounds = boardRef.current?.getBoundingClientRect()
    if (!bounds) return null
    const visualColumnCount = isPortrait ? BOARD_ROWS : BOARD_COLUMNS
    const visualRowCount = isPortrait ? BOARD_COLUMNS : BOARD_ROWS
    const visualColumn = Math.min(visualColumnCount - 1, Math.max(0, Math.floor(((event.clientX - bounds.left) / bounds.width) * visualColumnCount)))
    const visualRow = Math.min(visualRowCount - 1, Math.max(0, Math.floor(((event.clientY - bounds.top) / bounds.height) * visualRowCount)))
    return isPortrait ? { row: visualColumn, column: visualRow } : { row: visualRow, column: visualColumn }
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return
    const point = pointFromEvent(event)
    if (!point) return
    if (typeof event.currentTarget.setPointerCapture === 'function') event.currentTarget.setPointerCapture(event.pointerId)
    activePointerIdRef.current = event.pointerId
    setKeyboardStart(null)
    setKeyboardPoint(point)
    setSelection({ start: point, end: point })
    setIsDragging(true)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || !isDragging) return
    pendingPoint.current = pointFromEvent(event)
    if (frameRef.current !== null) return
    frameRef.current = window.requestAnimationFrame(() => {
      const point = pendingPoint.current
      if (point) setSelection((current) => (current ? { ...current, end: point } : current))
      frameRef.current = null
    })
  }

  const finishSelection = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) {
      cancelActiveSelection()
      return
    }
    if (!isDragging || !selection) return
    cancelFrame()
    releaseActivePointer()
    const completed = normalizeRect({ ...selection, end: pointFromEvent(event) ?? selection.end })
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
    onSelectionEnd?.(completed, sum)
    setIsDragging(false)
    setSelection(null)
  }

  const activeSelection = selection
    ? normalizeRect(selection)
    : invalidRect ?? (keyboardStart ? normalizeRect({ start: keyboardStart, end: keyboardPoint }) : hint)
  const currentSum = activeSelection ? sumSelection(board, activeSelection) : 0
  const selectedCount = activeSelection ? getRectangleCells(activeSelection).filter(({ row, column }) => board[row]?.[column] !== null).length : 0
  const selectionState = currentSum === TARGET_SUM ? 'is-success' : currentSum > TARGET_SUM ? 'is-over' : ''
  const feedback = currentSum === TARGET_SUM ? '剛好 10！放開即可消除' : currentSum > TARGET_SUM ? `${currentSum} / 10，超過 ${currentSum - TARGET_SUM}` : `${currentSum} / 10，還差 ${TARGET_SUM - currentSum}`
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
    if (disabled) return
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
        onSelectionEnd?.(rect, sumSelection(board, rect))
        setKeyboardStart(null)
      }
    } else if (event.key === 'Escape') {
      setKeyboardStart(null)
    }
  }

  return (
    <div className="board-frame">
      <div
        ref={boardRef}
        className={`game-board${isPortrait ? ' is-portrait' : ''}`}
        style={{ gridTemplateColumns: `repeat(${isPortrait ? BOARD_ROWS : BOARD_COLUMNS}, 1fr)` }}
        role="grid"
        tabIndex={disabled ? -1 : 0}
        aria-label="水果數字棋盤"
        aria-description="使用方向鍵移動，按 Enter 設定矩形起點與終點；框內總和為 10 即可消除。"
        aria-disabled={disabled}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishSelection}
        onPointerCancel={cancelActiveSelection}
      >
        {board.flatMap((row, rowIndex) => row.map((value, columnIndex) => (
          <FruitCell
            key={`${rowIndex}-${columnIndex}`}
            value={value}
            index={rowIndex * BOARD_COLUMNS + columnIndex}
            highlighted={activeSelection ? isPointInRect({ row: rowIndex, column: columnIndex }, activeSelection) : false}
            animationsEnabled={animationsEnabled}
            style={isPortrait ? { gridColumn: rowIndex + 1, gridRow: columnIndex + 1 } : undefined}
          />
        )))}
        {activeSelection && <>
          <div className={`selection-overlay ${selectionState}${invalid ? ' is-invalid' : ''}${hint ? ' is-hint' : ''}`} style={overlayStyle} />
          <output className={`selection-sum ${selectionState}`} style={selectionSumStyle}>{feedback}<small>{selectedCount} 顆水果</small></output>
        </>}
        {!keyboardStart && !isDragging && <div className="keyboard-cursor" style={cursorStyle} aria-hidden="true" />}
      </div>
    </div>
  )
}
