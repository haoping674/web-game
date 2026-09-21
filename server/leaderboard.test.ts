import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { handleLeaderboard } from './leaderboard.ts'
import type { LeaderboardStore } from './leaderboard.ts'
import type { BoardId, LeaderboardData } from '../src/shared/leaderboard/boards.ts'

const db = new PGlite()
const store: LeaderboardStore = {
  async list(board) {
    const { rows } = await db.query<{ player_name: string; score: number }>('SELECT player_name, score FROM arcade_scores WHERE board = $1 ORDER BY sort_score, created_at, id LIMIT 10', [board])
    return rows.map((row, i) => ({ rank: i + 1, name: row.player_name, score: row.score }))
  },
  async submit({ board, score, name, submissionId }) {
    const { rows } = await db.query<{ result: LeaderboardData }>('SELECT arcade_submit_score($1, $2::integer, $3, $4::uuid) AS result', [board, score, name, submissionId])
    return rows[0].result
  },
}
const get = (board: string, score?: string) => new Request(`https://arcade.test/api/leaderboard?board=${board}${score === undefined ? '' : `&score=${score}`}`)
const post = (body: unknown, extraHeaders = {}) => new Request('https://arcade.test/api/leaderboard', { method: 'POST', headers: { 'Content-Type': 'application/json', ...extraHeaders }, body: JSON.stringify(body) })
const input = (score: number, board: BoardId = 'fruit-classic') => ({ board, score, name: '玩家', submissionId: randomUUID() })

beforeAll(async () => { await db.exec(await readFile('database/001_leaderboards.sql', 'utf8')) }, 30_000)
beforeEach(async () => { await db.exec('TRUNCATE arcade_scores RESTART IDENTITY') })
afterAll(async () => { await db.close() })

describe('leaderboard API and actual PostgreSQL schema', () => {
  it('starts empty, admits a qualifying score, and returns a public top ten', async () => {
    const empty = await handleLeaderboard(get('fruit-classic', '50'), store)
    expect(await empty.json()).toEqual({ entries: [], rank: 1, eligible: true })
    const saved = await handleLeaderboard(post({ ...input(50), name: '  小芽 🌱  ' }), store)
    expect(await saved.json()).toMatchObject({ accepted: true, rank: 1, entries: [{ name: '小芽 🌱', score: 50, rank: 1 }] })
    const listed = await handleLeaderboard(get('fruit-classic'), store)
    expect(listed.headers.get('cache-control')).toBe('no-store')
    expect(await listed.json()).toEqual({ entries: [{ name: '小芽 🌱', score: 50, rank: 1 }], rank: null, eligible: false })
  })
  it('orders scores descending, rejects tied eleventh, and allows a new tenth', async () => {
    for (let score = 100; score > 90; score--) await store.submit(input(score))
    expect(await store.submit(input(91))).toMatchObject({ accepted: false, rank: 11 })
    const result = await store.submit(input(92))
    expect(result).toMatchObject({ accepted: true, rank: 10 })
    expect(result.entries).toHaveLength(10)
    expect(result.entries.map(entry => entry.score)).toEqual([100, 99, 98, 97, 96, 95, 94, 93, 92, 92])
    expect((await db.query('SELECT * FROM arcade_scores')).rows).toHaveLength(11)
  })
  it('keeps all boards separate, with fastest time ascending including zero', async () => {
    for (const score of [20, 10, 0]) await store.submit(input(score, 'color-time'))
    await store.submit(input(80, 'color-removed'))
    await store.submit(input(95, 'ashbound-souls'))
    expect((await store.list('color-time')).map(entry => entry.score)).toEqual([0, 10, 20])
    expect(await store.list('fruit-classic')).toEqual([])
    expect((await store.list('ashbound-souls'))[0].score).toBe(95)
  })
  it('rechecks eligibility if another player fills the tenth place after the initial check', async () => {
    for (let i = 0; i < 9; i++) await store.submit(input(100))
    expect(await (await handleLeaderboard(get('fruit-classic', '50'), store)).json()).toMatchObject({ eligible: true, rank: 10 })
    await store.submit(input(80))
    expect(await (await handleLeaderboard(post(input(50)), store)).json()).toMatchObject({ accepted: false, eligible: false, rank: 11 })
  })
  it('retries the same submission once, but does not let the id change name or score', async () => {
    const submission = input(70)
    await store.submit(submission)
    expect(await store.submit(submission)).toMatchObject({ accepted: true, rank: 1 })
    expect((await store.list('fruit-classic'))).toHaveLength(1)
    await expect(store.submit({ ...submission, score: 100 })).rejects.toThrow('Submission already used')
    await expect(store.submit({ ...submission, name: '其他人' })).rejects.toThrow('Submission already used')
  })
  it('keeps earlier tied scores first', async () => {
    await store.submit({ ...input(40), name: '先到' })
    expect(await store.submit({ ...input(40), name: '後到' })).toMatchObject({ rank: 2, entries: [{ name: '先到' }, { name: '後到' }] })
  })
  it.each([
    { board: 'sprout-island' }, { score: 171 }, { score: -1 }, { score: 1.5 }, { score: '70' },
    { name: '   ' }, { name: '名字'.repeat(11) }, { name: '<script>' }, { name: 'a\u202Eb' }, { name: 'a\nb' },
    { submissionId: 'invalid' }, { board: 'color-time', score: 31 }, { board: 'ashbound-souls', score: 96 },
  ])('rejects invalid input before touching the database: %j', async change => {
    const submit = vi.fn()
    const response = await handleLeaderboard(post({ ...input(70), ...change }), { ...store, submit })
    expect(response.status).toBe(400)
    expect(submit).not.toHaveBeenCalled()
  })
  it('handles malformed JSON, oversized input, wrong methods, and cross-origin writes', async () => {
    expect((await handleLeaderboard(new Request('https://arcade.test/api/leaderboard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' }), store)).status).toBe(400)
    expect((await handleLeaderboard(post({ ...input(20), name: 'x'.repeat(2100) }), store)).status).toBe(413)
    expect((await handleLeaderboard(new Request('https://arcade.test/api/leaderboard', { method: 'DELETE' }), store)).status).toBe(405)
    expect((await handleLeaderboard(post(input(20), { Origin: 'https://other.test' }), store)).status).toBe(403)
    expect((await handleLeaderboard(get('fruit-classic', ''), store)).status).toBe(400)
    expect((await handleLeaderboard(get('constructor'), store)).status).toBe(400)
  })
  it('returns a recoverable error without leaking database details', async () => {
    expect((await handleLeaderboard(get('fruit-classic'))).status).toBe(503)
    const result = await handleLeaderboard(get('fruit-classic'), { ...store, list: async () => { throw new Error('postgresql://secret') } })
    expect(result.status).toBe(503)
    expect(await result.text()).not.toContain('secret')
  })
})
