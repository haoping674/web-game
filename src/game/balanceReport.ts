import { analyzeBoard } from './boardAnalyzer'
import { PROGRESS_CHECKPOINTS, simulateBoardProgress } from './boardSimulator'
import type { BaselineAggregate } from './balanceTypes'
import type { CellValue } from './types'

export type BoardReportRow = {
  index: number
  validMoves: number
  uniqueValidMoves: number
  coverageRatio: number
  twoCellMoves: number
  threeCellMoves: number
  fourPlusMoves: number
  occupiedRegions: number
  spatialDistributionScore: number
  maxCellParticipationRatio: number
  overlapScore: number
  largestMove: number
  averageArea: number
  scorePotential: number
  progress: ReturnType<typeof simulateBoardProgress>
}

export function createBalanceReport(boards: readonly CellValue[][][], seed: number): { aggregate: BaselineAggregate; boards: BoardReportRow[] } {
  const analyses = boards.map((board) => analyzeBoard(board))
  const progress = boards.map((board) => simulateBoardProgress(board))
  const rows = analyses.map((analysis, index): BoardReportRow => ({
    index,
    validMoves: analysis.validMoveCount,
    uniqueValidMoves: analysis.uniqueValidMoveCount,
    coverageRatio: analysis.coverageRatio,
    twoCellMoves: analysis.moveSizeDistribution.two,
    threeCellMoves: analysis.moveSizeDistribution.three,
    fourPlusMoves: analysis.moveSizeDistribution.fourPlus,
    occupiedRegions: analysis.occupiedRegionCount,
    spatialDistributionScore: analysis.spatialDistributionScore,
    maxCellParticipationRatio: analysis.maxCellParticipationRatio,
    overlapScore: analysis.overlapScore,
    largestMove: analysis.largestMove?.fruitCount ?? 0,
    averageArea: analysis.averageArea,
    scorePotential: analysis.scorePotential,
    progress: progress[index] ?? [],
  }))
  const validMoveCounts = analyses.map((analysis) => analysis.validMoveCount)
  const scorePotentials = analyses.map((analysis) => analysis.scorePotential)
  const digitFrequency = mergeRecords(analyses.map((analysis) => analysis.digitFrequency))
  const digitMoveParticipation = mergeRecords(analyses.map((analysis) => analysis.digitMoveParticipation))
  const aggregate: BaselineAggregate = {
    sampleSize: boards.length,
    seed,
    meanValidMoves: mean(validMoveCounts),
    validMovesStandardDeviation: standardDeviation(validMoveCounts),
    noMoveRate: ratio(analyses, (analysis) => analysis.validMoveCount === 0),
    lowMoveRate: ratio(analyses, (analysis) => analysis.validMoveCount < 20),
    extremeHighMoveRate: ratio(analyses, (analysis) => analysis.validMoveCount > 100),
    meanCoverageRatio: mean(analyses.map((analysis) => analysis.coverageRatio)),
    meanSpatialDistributionScore: mean(analyses.map((analysis) => analysis.spatialDistributionScore)),
    meanOverlapScore: mean(analyses.map((analysis) => analysis.overlapScore)),
    meanScorePotential: mean(scorePotentials),
    scorePotentialStandardDeviation: standardDeviation(scorePotentials),
    meanAverageArea: mean(analyses.map((analysis) => analysis.averageArea)),
    meanSimpleMoveRatio: mean(analyses.map((analysis) => analysis.simpleMoveRatio)),
    meanMaxCellParticipationRatio: mean(analyses.map((analysis) => analysis.maxCellParticipationRatio)),
    digitFrequency,
    digitMoveParticipation,
    progress: Object.fromEntries(PROGRESS_CHECKPOINTS.map((checkpoint, checkpointIndex) => {
      const snapshots = progress.map((boardProgress) => boardProgress[checkpointIndex]).filter((snapshot) => snapshot !== undefined)
      return [String(checkpoint), {
        reachedRate: ratio(snapshots, (snapshot) => snapshot.clearedRatio >= checkpoint),
        noMoveRate: ratio(snapshots, (snapshot) => !snapshot.hasMove),
        meanValidMoves: mean(snapshots.map((snapshot) => snapshot.validMoveCount)),
        meanCoverageRatio: mean(snapshots.map((snapshot) => snapshot.coverageRatio)),
        meanOccupiedRegions: mean(snapshots.map((snapshot) => snapshot.occupiedRegionCount)),
        meanRemainingScorePotential: mean(snapshots.map((snapshot) => snapshot.scorePotential)),
      }]
    })),
  }
  return { aggregate, boards: rows }
}

export function reportRowsToCsv(rows: readonly BoardReportRow[]): string {
  if (rows.length === 0) return ''
  const flattened = rows.map(({ progress, ...row }) => ({
    ...row,
    ...Object.fromEntries(progress.flatMap((snapshot, index) => [
      [`progress${index}ClearedRatio`, snapshot.clearedRatio],
      [`progress${index}ValidMoves`, snapshot.validMoveCount],
      [`progress${index}HasMove`, snapshot.hasMove],
    ])),
  }))
  const headers = Object.keys(flattened[0] ?? {})
  return [headers.join(','), ...flattened.map((row) => headers.map((header) => row[header as keyof typeof row]).join(','))].join('\n')
}

function ratio<T>(values: readonly T[], predicate: (value: T) => boolean): number {
  return values.length === 0 ? 0 : values.filter(predicate).length / values.length
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length
}

function standardDeviation(values: readonly number[]): number {
  if (values.length === 0) return 0
  const average = mean(values)
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)))
}

function mergeRecords(records: readonly Record<number, number>[]): Record<number, number> {
  const merged: Record<number, number> = {}
  records.forEach((record) => Object.entries(record).forEach(([key, value]) => {
    const numericKey = Number(key)
    merged[numericKey] = (merged[numericKey] ?? 0) + value
  }))
  return merged
}
