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

type PathLevelBlueprint = Omit<LevelBlueprint, 'orientation'> & {
  path: readonly NumberPathPosition[]
  blocked?: readonly NumberPathPosition[]
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

function positionKey(position: NumberPathPosition): string {
  return `${position.row}:${position.column}`
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

export function buildNumberPathLevel({ path, blocked = [], ...blueprint }: PathLevelBlueprint): NumberPathLevel {
  const blockedKeys = new Set(blocked.map(positionKey))
  const pathValues = new Map(path.map((position, index) => [positionKey(position), index + 1] as const))
  const maxNumber = path.length
  const cells: NumberPathCell[] = []

  for (let row = 0; row < blueprint.rows; row += 1) {
    for (let column = 0; column < blueprint.columns; column += 1) {
      const key = positionKey({ row, column })
      const value = pathValues.get(key)
      const isBlocked = blockedKeys.has(key)
      if (isBlocked || value === undefined) {
        cells.push({ row, column, value: 0, visible: false, blocked: true })
        continue
      }
      cells.push({
        row,
        column,
        value,
        visible: value === 1 || value === maxNumber || value % blueprint.clueStride === 1,
        blocked: false,
      })
    }
  }

  return { ...blueprint, maxNumber, cells }
}

const BLUEPRINTS = [
  { id: 'path-easy-01', name: '起步繞行', difficulty: 'easy', rows: 4, columns: 4, orientation: 'rows', clueStride: 2 },
  { id: 'path-easy-02', name: '轉角穿梭', difficulty: 'easy', rows: 4, columns: 5, orientation: 'columns', clueStride: 2 },
  { id: 'path-normal-01', name: '長徑回環', difficulty: 'normal', rows: 4, columns: 5, orientation: 'rows', clueStride: 3 },
  { id: 'path-normal-02', name: '側向脈絡', difficulty: 'normal', rows: 5, columns: 4, orientation: 'columns', clueStride: 3 },
  { id: 'path-hard-01', name: '緊密棋局', difficulty: 'hard', rows: 5, columns: 5, orientation: 'rows', clueStride: 3 },
  { id: 'path-hard-02', name: '交錯潮流', difficulty: 'hard', rows: 5, columns: 5, orientation: 'columns', clueStride: 3 },
] as const satisfies readonly LevelBlueprint[]

const OBSTACLE_BLUEPRINT = {
  id: 'path-hard-03',
  name: '石階迷徑',
  difficulty: 'hard',
  rows: 5,
  columns: 5,
  clueStride: 3,
  blocked: [{ row: 1, column: 1 }, { row: 3, column: 3 }],
  path: [
    { row: 0, column: 1 }, { row: 0, column: 0 }, { row: 1, column: 0 }, { row: 2, column: 0 },
    { row: 2, column: 1 }, { row: 2, column: 2 }, { row: 1, column: 2 }, { row: 0, column: 2 },
    { row: 0, column: 3 }, { row: 0, column: 4 }, { row: 1, column: 4 }, { row: 1, column: 3 },
    { row: 2, column: 3 }, { row: 2, column: 4 }, { row: 3, column: 4 }, { row: 4, column: 4 },
    { row: 4, column: 3 }, { row: 4, column: 2 }, { row: 3, column: 2 }, { row: 3, column: 1 },
    { row: 4, column: 1 }, { row: 4, column: 0 }, { row: 3, column: 0 },
  ],
} as const satisfies PathLevelBlueprint

export const NUMBER_PATH_LEVELS = [...BLUEPRINTS.map(buildLevel), buildNumberPathLevel(OBSTACLE_BLUEPRINT)]

export const NUMBER_PATH_LEVELS_BY_ID = new Map(NUMBER_PATH_LEVELS.map((level) => [level.id, level] as const))

export function getNumberPathLevel(levelId: string | null): NumberPathLevel | undefined {
  return levelId === null ? undefined : NUMBER_PATH_LEVELS_BY_ID.get(levelId)
}

export function levelsForDifficulty(difficulty: NumberPathDifficulty): readonly NumberPathLevel[] {
  return NUMBER_PATH_LEVELS.filter((level) => level.difficulty === difficulty)
}
