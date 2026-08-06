import { useCallback, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { positionKey } from './rules'
import type { NumberPathLevel, NumberPathPosition } from './types'

type BoardPoint = NumberPathPosition & { x: number; y: number }

type NumberPathBoardProps = {
  level: NumberPathLevel
  path: readonly NumberPathPosition[]
  disabled: boolean
  showSolvedNumbers: boolean
  invalidPosition: NumberPathPosition | null
  hintCandidates: readonly NumberPathPosition[]
  eliminatedPositions: readonly NumberPathPosition[]
  hintTarget: NumberPathPosition | null
  revealedPosition: NumberPathPosition | null
  onAttempt: (position: NumberPathPosition) => void
}

function hasPosition(positions: readonly NumberPathPosition[], position: NumberPathPosition): boolean {
  return positions.some((candidate) => candidate.row === position.row && candidate.column === position.column)
}

export function NumberPathBoard({
  level,
  path,
  disabled,
  showSolvedNumbers,
  invalidPosition,
  hintCandidates,
  eliminatedPositions,
  hintTarget,
  revealedPosition,
  onAttempt,
}: NumberPathBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null)
  const cellRefs = useRef(new Map<string, HTMLButtonElement>())
  const activePointer = useRef<number | null>(null)
  const lastDragKey = useRef<string | null>(null)
  const suppressClick = useRef(false)
  const [points, setPoints] = useState<ReadonlyMap<string, BoardPoint>>(new Map())
  const pathKeys = useMemo(() => new Set(path.map(positionKey)), [path])

  const measurePoints = useCallback(() => {
    const board = boardRef.current
    if (!board) return
    const boardRect = board.getBoundingClientRect()
    if (boardRect.width === 0 || boardRect.height === 0) return
    const next = new Map<string, BoardPoint>()
    cellRefs.current.forEach((cell, key) => {
      const rect = cell.getBoundingClientRect()
      next.set(key, {
        row: Number(cell.style.gridRowStart) - 1,
        column: Number(cell.style.gridColumnStart) - 1,
        x: rect.left - boardRect.left + rect.width / 2,
        y: rect.top - boardRect.top + rect.height / 2,
      })
    })
    setPoints(next)
  }, [])

  useLayoutEffect(() => {
    const frame = window.requestAnimationFrame(measurePoints)
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measurePoints)
    if (boardRef.current) observer?.observe(boardRef.current)
    window.addEventListener('resize', measurePoints)
    return () => {
      window.cancelAnimationFrame(frame)
      observer?.disconnect()
      window.removeEventListener('resize', measurePoints)
    }
  }, [level.id, measurePoints, path])

  const positionFromPoint = (clientX: number, clientY: number): NumberPathPosition | undefined => {
    const target = document.elementFromPoint(clientX, clientY)
    if (!target) return undefined
    for (const [key, cell] of cellRefs.current) {
      if (target === cell || cell.contains(target)) {
        if (cell.disabled) return undefined
        const [row, column] = key.split(':').map(Number)
        return Number.isFinite(row) && Number.isFinite(column) ? { row, column } : undefined
      }
    }
    return undefined
  }

  const submitPointerPosition = (position: NumberPathPosition) => {
    const key = positionKey(position)
    if (lastDragKey.current === key) return
    lastDragKey.current = key
    onAttempt(position)
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>, position: NumberPathPosition) => {
    if (disabled) return
    event.preventDefault()
    suppressClick.current = true
    activePointer.current = event.pointerId
    lastDragKey.current = null
    event.currentTarget.setPointerCapture(event.pointerId)
    submitPointerPosition(position)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || activePointer.current !== event.pointerId) return
    event.preventDefault()
    const position = positionFromPoint(event.clientX, event.clientY)
    if (position) submitPointerPosition(position)
  }

  const endPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointer.current !== event.pointerId) return
    activePointer.current = null
    lastDragKey.current = null
  }

  return (
    <div className="number-board-frame">
      <div
        ref={boardRef}
        className="number-path-board"
        role="grid"
        aria-label="數字路徑棋盤"
        style={{ '--number-rows': level.rows, '--number-columns': level.columns } as CSSProperties}
        onPointerMove={handlePointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
      >
        <svg className="number-path-lines" viewBox={`0 0 ${Math.max(1, boardRef.current?.clientWidth ?? 1)} ${Math.max(1, boardRef.current?.clientHeight ?? 1)}`} aria-hidden="true">
          {path.slice(1).map((position, index) => {
            const previous = path[index]
            const from = previous ? points.get(positionKey(previous)) : undefined
            const to = points.get(positionKey(position))
            if (!from || !to) return null
            return <line key={`${positionKey(previous)}-${positionKey(position)}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
          })}
        </svg>
        {level.cells.map((cell) => {
          const position = { row: cell.row, column: cell.column }
          const key = positionKey(position)
          const connected = pathKeys.has(key)
          const showValue = cell.visible || (connected && showSolvedNumbers) || (revealedPosition !== null && positionKey(revealedPosition) === key)
          const className = [
            'number-path-cell',
            cell.visible ? 'is-clue' : 'is-hidden',
            cell.blocked ? 'is-blocked' : '',
            connected ? 'is-connected' : '',
            invalidPosition !== null && positionKey(invalidPosition) === key ? 'is-invalid' : '',
            hasPosition(hintCandidates, position) ? 'is-hint-candidate' : '',
            hasPosition(eliminatedPositions, position) ? 'is-hint-eliminated' : '',
            hintTarget !== null && positionKey(hintTarget) === key ? 'is-hint-target' : '',
          ].filter(Boolean).join(' ')
          return (
            <button
              key={key}
              ref={(node) => {
                if (node) cellRefs.current.set(key, node)
                else cellRefs.current.delete(key)
              }}
              type="button"
              className={className}
              disabled={disabled || cell.blocked}
              style={{ gridRowStart: cell.row + 1, gridColumnStart: cell.column + 1 }}
              aria-label={cell.blocked ? '障礙格' : cell.visible ? `公開數字 ${cell.value}` : connected ? '已連接的隱藏格' : '未公開的路徑格'}
              onPointerDown={(event) => handlePointerDown(event, position)}
              onClick={() => {
                if (suppressClick.current) {
                  suppressClick.current = false
                  return
                }
                onAttempt(position)
              }}
            >
              {showValue ? <span>{cell.value}</span> : <i aria-hidden="true" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
