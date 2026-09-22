export const LEADERBOARD_LIMIT = 10
export const BOARDS = {
  'fruit-classic': { title: 'Orchard Ten · 經典分數', unit: '分', ascending: false, min: 0, max: 170, rule: '分數越高越前面。' },
  'color-time': { title: 'Color Links · 最快清空', unit: '秒', ascending: true, min: 0, max: 30, rule: '限時內清空才列入，秒數越少越前面（包含失誤扣秒）。' },
  'color-removed': { title: 'Color Links · 逾時消除', unit: '格', ascending: false, min: 0, max: 170, rule: '未清空的回合依消除格數排名，越多越前面。' },
  'ashbound-souls': { title: '灰燼墓誌 · 單次魂燼', unit: '魂燼', ascending: false, min: 1, max: 2147483647, rule: '擊敗數 × 2 ＋ 層數，每擊敗一次無晝之王再加 25；包含永久傳承加成的遠征。' },
} as const
export type BoardId = keyof typeof BOARDS
export type LeaderboardEntry = { rank: number; name: string; score: number }
export type LeaderboardData = { entries: LeaderboardEntry[]; rank: number | null; eligible: boolean; accepted?: boolean }
export type Submission = { board: BoardId; score: number; name: string; submissionId: string }

export function isBoardId(value: unknown): value is BoardId {
  return typeof value === 'string' && Object.hasOwn(BOARDS, value)
}
export function validScore(board: BoardId, value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= BOARDS[board].min && value <= BOARDS[board].max
}
export function normalizeName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const name = value.normalize('NFC').trim()
  // Exclude invisible control characters and markup. React also renders names as text.
  if (!name || Array.from(name).length > 20 || /[\p{Cc}\p{Cf}<>]/u.test(name)) return null
  return name
}
export function candidateRank(board: BoardId, score: number, entries: LeaderboardEntry[]): number {
  return entries.filter(entry => BOARDS[board].ascending ? entry.score <= score : entry.score >= score).length + 1
}
