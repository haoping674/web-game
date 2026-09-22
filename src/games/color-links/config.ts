export const COLOR_LINKS_CONFIG = {
  rows: 10,
  columns: 17,
  initialTileCount: 100,
  timeLimitSeconds: 30,
  invalidPenaltySeconds: 2,
  targetFilledRatio: 100 / 170,
  minimumOpeningMoves: 12,
  generationAttempts: 80,
  effectDurationMs: 420,
  duplicateInputWindowMs: 180,
} as const
