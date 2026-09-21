import { neon } from '@neondatabase/serverless'
import { candidateRank, isBoardId, LEADERBOARD_LIMIT, normalizeName, validScore } from '../src/shared/leaderboard/boards.ts'
import type { BoardId, LeaderboardData, LeaderboardEntry, Submission } from '../src/shared/leaderboard/boards.ts'

export type LeaderboardStore = {
  list: (board: BoardId) => Promise<LeaderboardEntry[]>
  submit: (submission: Submission) => Promise<LeaderboardData>
}

export function neonStore(connectionString: string): LeaderboardStore {
  const sql = neon(connectionString, { fetchOptions: { signal: AbortSignal.timeout(10_000) } })
  return {
    async list(board) {
      const rows = await sql`SELECT player_name, score FROM arcade_scores
        WHERE board = ${board} ORDER BY sort_score, created_at, id LIMIT 10`
      return rows.map((row, index) => ({ rank: index + 1, name: String(row.player_name), score: Number(row.score) }))
    },
    async submit({ board, score, name, submissionId }) {
      const rows = await sql`SELECT arcade_submit_score(${board}, ${score}::integer, ${name}, ${submissionId}::uuid) AS result`
      return rows[0].result as LeaderboardData
    },
  }
}

function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
}

export async function handleLeaderboard(request: Request, store?: LeaderboardStore): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'POST') {
    const response = json({ error: '不支援此操作。' }, 405)
    response.headers.set('Allow', 'GET, POST')
    return response
  }
  const url = new URL(request.url)
  let input: Record<string, unknown>
  if (request.method === 'POST') {
    const origin = request.headers.get('origin')
    if ((origin && origin !== url.origin) || request.headers.get('sec-fetch-site') === 'cross-site') return json({ error: '請從遊戲網站送出成績。' }, 403)
    if (!request.headers.get('content-type')?.startsWith('application/json')) return json({ error: '請使用 JSON 格式。' }, 415)
    const body = await request.text()
    if (body.length > 2048) return json({ error: '資料過長。' }, 413)
    try {
      const parsed: unknown = JSON.parse(body)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return json({ error: '資料格式不正確。' }, 400)
      input = parsed as Record<string, unknown>
    } catch { return json({ error: '資料格式不正確。' }, 400) }
  } else {
    input = Object.fromEntries(url.searchParams)
    if (url.searchParams.has('score')) input.score = /^\d+$/.test(String(input.score)) ? Number(input.score) : NaN
  }
  const board = input.board
  if (!isBoardId(board)) return json({ error: '找不到這個排行榜。' }, 400)
  const score = input.score
  if ((score !== undefined || request.method === 'POST') && !validScore(board, score)) return json({ error: '成績不符合這個排行榜的範圍。' }, 400)
  let submission: Submission | undefined
  if (request.method === 'POST') {
    const name = normalizeName(input.name)
    const id = input.submissionId
    if (!name) return json({ error: '請輸入 1–20 個字的名字，不含控制字元或 < >。' }, 400)
    if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return json({ error: '成績識別碼不正確。' }, 400)
    submission = { board, score: score as number, name, submissionId: id }
  }
  if (!store) return json({ error: '排行榜尚未連線，請稍後再試。本機紀錄不受影響。' }, 503)
  try {
    if (submission) return json(await store.submit(submission))
    const entries = await store.list(board)
    const rank = typeof score === 'number' ? candidateRank(board, score, entries) : null
    return json({ entries, rank, eligible: rank !== null && rank <= LEADERBOARD_LIMIT } satisfies LeaderboardData)
  } catch {
    // Never include connection strings, SQL, or player data in error responses/logs.
    return json({ error: '排行榜暫時無法使用，請稍後重試。本機紀錄不受影響。' }, 503)
  }
}

export async function leaderboardRequest(request: Request): Promise<Response> {
  try {
    const connection = process.env.DATABASE_URL
    return await handleLeaderboard(request, connection ? neonStore(connection) : undefined)
  } catch { return json({ error: '排行榜暫時無法使用，請稍後重試。' }, 503) }
}
