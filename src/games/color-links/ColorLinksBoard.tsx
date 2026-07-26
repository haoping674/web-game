import type { CSSProperties } from 'react'
import type { CellPosition, ColorId, ColorLinksBoard, MatchGroup } from './types'

export const COLOR_META = {
  coral: { label: '珊瑚', symbol: '●', value: '#df715f' },
  amber: { label: '琥珀', symbol: '◆', value: '#d9a62e' },
  teal: { label: '松綠', symbol: '≋', value: '#327b77' },
  blue: { label: '湖藍', symbol: '＋', value: '#4a76a8' },
  plum: { label: '梅紫', symbol: '✦', value: '#8b668e' },
} as const satisfies Record<ColorId, { label: string; symbol: string; value: string }>

export type ColorLinksEffect = {
  id: number
  origin: CellPosition
  matches: MatchGroup[]
  points: number
}

type ColorLinksBoardProps = {
  board: ColorLinksBoard
  disabled?: boolean
  invalidCell?: CellPosition | null
  effect?: ColorLinksEffect | null
  reducedMotion?: boolean
  onSelect?: (position: CellPosition) => void
}

function sameCell(left: CellPosition | null | undefined, right: CellPosition): boolean {
  return left?.row === right.row && left.column === right.column
}

function EffectLayer({ effect, rows, columns, reducedMotion }: {
  effect: ColorLinksEffect
  rows: number
  columns: number
  reducedMotion: boolean
}) {
  const originX = ((effect.origin.column + 0.5) / columns) * 100
  const originY = ((effect.origin.row + 0.5) / rows) * 100
  return (
    <div
      className={`color-effect-layer${reducedMotion ? ' is-reduced' : ''}`}
      data-effect-id={effect.id}
      data-testid="color-effect-layer"
      style={{ '--origin-x': `${originX}%`, '--origin-y': `${originY}%`, pointerEvents: 'none' } as CSSProperties}
      aria-hidden="true"
    >
      <span className="color-effect-core" />
      {effect.matches.flatMap((match) => {
        const meta = COLOR_META[match.color]
        return match.tiles.map((tile) => {
          const targetX = ((tile.column + 0.5) / columns) * 100
          const targetY = ((tile.row + 0.5) / rows) * 100
          const deltaX = targetX - originX
          const deltaY = targetY - originY
          const length = Math.hypot(deltaX, deltaY)
          const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI)
          const style = {
            '--effect-color': meta.value,
            '--target-x': `${targetX}%`,
            '--target-y': `${targetY}%`,
            '--line-length': `${length}%`,
            '--line-angle': `${angle}deg`,
          } as CSSProperties
          return (
            <span key={`${match.color}-${tile.direction}`} className="color-effect-target" style={style}>
              <i className="color-link-line" />
              <i className="color-target-pulse" />
              {reducedMotion ? null : (
                <span className="color-particle-cluster">
                  {Array.from({ length: 4 }, (_, index) => (
                    <b key={index} style={{ '--particle-index': index } as CSSProperties} />
                  ))}
                </span>
              )}
            </span>
          )
        })
      })}
      <strong className="color-score-pop">+{effect.points}</strong>
    </div>
  )
}

export function ColorLinksBoard({
  board,
  disabled = false,
  invalidCell = null,
  effect = null,
  reducedMotion = false,
  onSelect,
}: ColorLinksBoardProps) {
  const rows = board.length
  const columns = board[0]?.length ?? 0
  return (
    <div className="color-board-frame">
      <div
        className="color-links-board"
        role="grid"
        aria-label="Color Links 色彩棋盤"
        aria-rowcount={rows}
        aria-colcount={columns}
        style={{ '--color-columns': columns, '--color-rows': rows } as CSSProperties}
      >
        {board.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className="color-board-row"
            role="row"
            aria-rowindex={rowIndex + 1}
          >
            {row.map((cell, column) => {
              const position = { row: rowIndex, column }
              const meta = cell === null ? null : COLOR_META[cell]
              const isInvalid = cell === null && sameCell(invalidCell, position)
              return (
                <button
                  key={`${rowIndex}-${column}`}
                  type="button"
                  role="gridcell"
                  aria-colindex={column + 1}
                  aria-label={
                    meta
                      ? `第 ${rowIndex + 1} 列第 ${column + 1} 欄，${meta.label}色塊`
                      : `第 ${rowIndex + 1} 列第 ${column + 1} 欄，空格`
                  }
                  className={`color-cell ${cell === null ? 'is-color-empty' : `is-color-tile color-${cell}`}${isInvalid ? ' is-invalid-link' : ''}`}
                  disabled={disabled || cell !== null}
                  onClick={() => onSelect?.(position)}
                >
                  {meta ? <span aria-hidden="true">{meta.symbol}</span> : <span className="empty-cell-dot" aria-hidden="true" />}
                </button>
              )
            })}
          </div>
        ))}
      </div>
      {effect ? (
        <EffectLayer effect={effect} rows={rows} columns={columns} reducedMotion={reducedMotion} />
      ) : null}
    </div>
  )
}
