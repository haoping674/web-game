import { useRef, useState } from 'react'
import { BOARD_COLUMNS, BOARD_ROWS, TARGET_SUM } from '../game/constants'
import { isPointInRect, normalizeRect, sumSelection } from '../game/selectionCalculator'
import type { CellValue, GridPoint, GridRect } from '../game/types'
import { FruitCell } from './FruitCell'

type GameBoardProps = {
  board: CellValue[][]
  onSelectionEnd?: (rect: GridRect, sum: number) => void
  disabled?: boolean
}

export function GameBoard({ board, onSelectionEnd, disabled = false }: GameBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null)
  const [selection, setSelection] = useState<GridRect | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [invalid, setInvalid] = useState(false)
  const [invalidRect, setInvalidRect] = useState<GridRect | null>(null)
  const [keyboardPoint, setKeyboardPoint] = useState<GridPoint>({ row: 0, column: 0 })
  const [keyboardStart, setKeyboardStart] = useState<GridPoint | null>(null)

  const pointFromEvent = (event: React.PointerEvent<HTMLDivElement>): GridPoint | null => {
    const bounds = boardRef.current?.getBoundingClientRect()
    if (!bounds) return null
    const column = Math.min(BOARD_COLUMNS - 1, Math.max(0, Math.floor(((event.clientX - bounds.left) / bounds.width) * BOARD_COLUMNS)))
    const row = Math.min(BOARD_ROWS - 1, Math.max(0, Math.floor(((event.clientY - bounds.top) / bounds.height) * BOARD_ROWS)))
    return { row, column }
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return
    const point = pointFromEvent(event)
    if (!point) return
    event.currentTarget.setPointerCapture(event.pointerId)
    setSelection({ start: point, end: point })
    setIsDragging(true)
  }
  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return
    const point = pointFromEvent(event)
    if (point) setSelection((current) => current ? { ...current, end: point } : current)
  }
  const finishSelection = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !selection) return
    event.currentTarget.releasePointerCapture(event.pointerId)
    const point = pointFromEvent(event) ?? selection.end
    const completed = normalizeRect({ ...selection, end: point })
    const sum = sumSelection(board, completed)
    if (sum !== TARGET_SUM) {
      setInvalid(true)
      setInvalidRect(completed)
      window.setTimeout(() => { setInvalid(false); setInvalidRect(null) }, 230)
    }
    onSelectionEnd?.(completed, sum)
    setIsDragging(false)
    setSelection(null)
  }
  const activeSelection = selection ? normalizeRect(selection) : invalidRect ?? (keyboardStart ? normalizeRect({ start: keyboardStart, end: keyboardPoint }) : null)
  const currentSum = activeSelection ? sumSelection(board, activeSelection) : 0
  const overlayStyle = activeSelection ? {
    gridColumn: `${activeSelection.start.column + 1} / ${activeSelection.end.column + 2}`,
    gridRow: `${activeSelection.start.row + 1} / ${activeSelection.end.row + 2}`,
  } : undefined
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return
    const movement: Record<string, GridPoint> = { ArrowUp: { row: -1, column: 0 }, ArrowDown: { row: 1, column: 0 }, ArrowLeft: { row: 0, column: -1 }, ArrowRight: { row: 0, column: 1 } }
    if (event.key in movement) {
      event.preventDefault()
      const delta = movement[event.key]!
      setKeyboardPoint((point) => ({ row: Math.min(BOARD_ROWS - 1, Math.max(0, point.row + delta.row)), column: Math.min(BOARD_COLUMNS - 1, Math.max(0, point.column + delta.column)) }))
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (!keyboardStart) setKeyboardStart(keyboardPoint)
      else { const rect = normalizeRect({ start: keyboardStart, end: keyboardPoint }); onSelectionEnd?.(rect, sumSelection(board, rect)); setKeyboardStart(null) }
    } else if (event.key === 'Escape') setKeyboardStart(null)
  }

  return (
    <div className="board-frame">
      <div ref={boardRef} className="game-board" style={{ gridTemplateColumns: `repeat(${BOARD_COLUMNS}, 1fr)` }} role="grid" tabIndex={disabled ? -1 : 0} aria-label="數字果園棋盤" aria-description="方向鍵移動，Enter 或空白鍵標記起點和終點。" aria-disabled={disabled} onKeyDown={handleKeyDown} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={finishSelection} onPointerCancel={finishSelection}>
        {board.flatMap((row, rowIndex) => row.map((value, columnIndex) => (
          <FruitCell key={`${rowIndex}-${columnIndex}`} value={value} index={rowIndex * BOARD_COLUMNS + columnIndex} highlighted={activeSelection ? isPointInRect({ row: rowIndex, column: columnIndex }, activeSelection) : false} />
        )))}
        {activeSelection && <><div className={`selection-overlay${invalid ? ' is-invalid' : ''}`} style={overlayStyle} /><output className="selection-sum" style={{ gridColumn: activeSelection.end.column + 1, gridRow: activeSelection.start.row + 1 }}>{currentSum} / 10</output></>}
        {!keyboardStart && <div className="keyboard-cursor" style={{ gridColumn: keyboardPoint.column + 1, gridRow: keyboardPoint.row + 1 }} aria-hidden="true" />}
      </div>
    </div>
  )
}
