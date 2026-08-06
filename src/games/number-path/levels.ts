import type { NumberPathCell, NumberPathDifficulty, NumberPathLevel, NumberPathPosition } from './types'

type LevelBlueprint = {
  id: string
  name: string
  difficulty: NumberPathDifficulty
  rows: number
  columns: number
  orientation: 'rows' | 'columns'
  clueStride: number
}

function makePath({ rows, columns, orientation }: Pick<LevelBlueprint, 'rows' | 'columns' | 'orientation'>): NumberPathPosition[] {
  const path: NumberPathPosition[] = []
  if (orientation === 'rows') {
    for (let row = 0; row < rows; row += 1) {
      const columnsInOrder = row % 2 === 0
        ? Array.from({ length: columns }, (_, index) => index)
        : Array.from({ length: columns }, (_, index) => columns - index - 1)
      columnsInOrder.forEach((column) => path.push({ row, column }))
    }
    return path
  }
  for (let column = 0; column < columns; column += 1) {
    const rowsInOrder = column % 2 === 0
      ? Array.from({ length: rows }, (_, index) => index)
      : Array.from({ length: rows }, (_, index) => rows - index - 1)
    rowsInOrder.forEach((row) => path.push({ row, column }))
  }
  return path
}

function isTurnCell(position: NumberPathPosition, blueprint: LevelBlueprint): boolean {
  return blueprint.orientation === 'rows'
    ? position.column === 0 || position.column === blueprint.columns - 1
    : position.row === 0 || position.row === blueprint.rows - 1
}

function buildLevel(blueprint: LevelBlueprint): NumberPathLevel {
  const path = makePath(blueprint)
  const maxNumber = path.length
  const cells: NumberPathCell[] = path.map((position, index) => {
    const value = index + 1
    return {
      ...position,
      value,
      // Every hidden section is bounded by clues; turns stay visible so each preset
      // remains a reasoning puzzle rather than a blind path guess.
      visible: value === 1 || value === maxNumber || value % blueprint.clueStride === 1 || isTurnCell(position, blueprint),
      blocked: false,
    }
  })
  return { ...blueprint, maxNumber, cells }
}

const BLUEPRINTS = [
  { id: 'path-easy-01', name: '晨光走廊', difficulty: 'easy', rows: 4, columns: 4, orientation: 'rows', clueStride: 2 },
  { id: 'path-easy-02', name: '方格花園', difficulty: 'easy', rows: 4, columns: 5, orientation: 'columns', clueStride: 2 },
  { id: 'path-normal-01', name: '轉角書架', difficulty: 'normal', rows: 4, columns: 5, orientation: 'rows', clueStride: 3 },
  { id: 'path-normal-02', name: '午後棋盤', difficulty: 'normal', rows: 5, columns: 4, orientation: 'columns', clueStride: 3 },
  { id: 'path-hard-01', name: '靜默迴廊', difficulty: 'hard', rows: 5, columns: 5, orientation: 'rows', clueStride: 3 },
  { id: 'path-hard-02', name: '深夜折線', difficulty: 'hard', rows: 5, columns: 5, orientation: 'columns', clueStride: 3 },
] as const satisfies readonly LevelBlueprint[]

export const NUMBER_PATH_LEVELS = BLUEPRINTS.map(buildLevel)

export const NUMBER_PATH_LEVELS_BY_ID = new Map(NUMBER_PATH_LEVELS.map((level) => [level.id, level] as const))

export function getNumberPathLevel(levelId: string | null): NumberPathLevel | undefined {
  return levelId === null ? undefined : NUMBER_PATH_LEVELS_BY_ID.get(levelId)
}

export function levelsForDifficulty(difficulty: NumberPathDifficulty): readonly NumberPathLevel[] {
  return NUMBER_PATH_LEVELS.filter((level) => level.difficulty === difficulty)
}
