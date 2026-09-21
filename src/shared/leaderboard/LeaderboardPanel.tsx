import { useEffect, useId, useRef, useState } from 'react'
import { BOARDS, normalizeName, validScore } from './boards'
import type { BoardId, LeaderboardData } from './boards'
import './leaderboard.css'

type Props = { board: BoardId; score?: number; resultKey?: string }
class LeaderboardError extends Error {}
type Receipt = { id: string; name?: string; accepted?: boolean }
const RECEIPT_KEY = 'orchard-leaderboard-last-result'

function readName(): string {
  try { return localStorage.getItem('orchard-leaderboard-name') ?? '' } catch { return '' }
}

function resultReceipt(resultKey?: string): Receipt {
  // A resumed Ashbound ending must keep the same id, including across tabs.
  if (resultKey) {
    try {
      const previous = JSON.parse(localStorage.getItem(RECEIPT_KEY) ?? 'null')
      if (previous?.key === resultKey && typeof previous.id === 'string') return {
        id: previous.id,
        name: normalizeName(previous.name) ?? undefined,
        accepted: previous.accepted === true,
      }
    } catch { /* Storage is optional. */ }
  }
  const id = crypto.randomUUID()
  if (resultKey) {
    saveReceipt(resultKey, { id })
  }
  return { id }
}

function saveReceipt(resultKey: string, receipt: Receipt): void {
  try { localStorage.setItem(RECEIPT_KEY, JSON.stringify({ key: resultKey, ...receipt })) } catch { /* Retry remains stable in memory. */ }
}

async function requestLeaderboard(url: string, init: RequestInit): Promise<LeaderboardData> {
  const response = await fetch(url, { ...init, cache: 'no-store' })
  const data = await response.json()
  if (!response.ok) throw new LeaderboardError(typeof data.error === 'string' ? data.error : '排行榜暫時無法使用，請稍後重試。')
  if (!Array.isArray(data.entries) || typeof data.eligible !== 'boolean') throw new LeaderboardError('排行榜回應異常，請稍後重試。')
  return data as LeaderboardData
}

export function LeaderboardPanel({ board, score, resultKey }: Props) {
  const [receipt] = useState(() => resultReceipt(resultKey))
  const [data, setData] = useState<LeaderboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [name, setName] = useState(() => receipt.name ?? readName())
  const [saving, setSaving] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const submissionId = receipt.id
  const sending = useRef(false)
  const submittedName = useRef<string | null>(receipt.name ?? null)
  const mounted = useRef(true)
  const fieldId = useId()
  const details = BOARDS[board]
  const canSubmitScore = score !== undefined && validScore(board, score)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 12_000)
    let active = true
    setLoading(true)
    setError('')
    const query = new URLSearchParams({ board })
    if (canSubmitScore) query.set('score', String(score))
    void requestLeaderboard(`/api/leaderboard?${query}`, { signal: controller.signal })
      .then(value => { if (active) setData(receipt.accepted ? { ...value, accepted: true, rank: null } : value) })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof LeaderboardError ? reason.message : '無法連線至排行榜，請確認網路後重試。本機紀錄不受影響。')
      })
      .finally(() => { if (active) setLoading(false); window.clearTimeout(timeout) })
    return () => { active = false; controller.abort(); window.clearTimeout(timeout) }
  }, [board, score, canSubmitScore, refresh, receipt.accepted])

  const submit = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (sending.current || !canSubmitScore || !data?.eligible || data.accepted) return
    const normalized = submittedName.current ?? normalizeName(name)
    if (!normalized) { setError('請輸入 1–20 個字的名字，不含控制字元或 < >。'); return }
    sending.current = true
    submittedName.current = normalized
    if (resultKey) saveReceipt(resultKey, { id: submissionId, name: normalized })
    setName(normalized)
    setSaving(true)
    setError('')
    try {
      const value = await requestLeaderboard('/api/leaderboard', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(12_000),
        body: JSON.stringify({ board, score, name: normalized, submissionId }),
      })
      if (!mounted.current) return
      setData(value)
      if (value.accepted) {
        if (resultKey) saveReceipt(resultKey, { id: submissionId, name: normalized, accepted: true })
        try { localStorage.setItem('orchard-leaderboard-name', normalized) } catch { /* Optional convenience. */ }
      }
    } catch {
      if (mounted.current) setError('未能確認儲存結果，請按「儲存名字與成績」重試；不會重複登錄。')
    } finally {
      sending.current = false
      if (mounted.current) setSaving(false)
    }
  }

  return <section className="leaderboard-panel" aria-label={details.title} aria-busy={loading || saving}>
    <header className="leaderboard-heading"><h3>{details.title}</h3><span>TOP 10</span></header>
    <p className="leaderboard-rule">{details.rule} 同分先登錄者優先。</p>
    {loading ? <p role="status">正在讀取排行榜…</p> : null}
    {error ? <div className="leaderboard-error" role="alert"><p>{error}</p>{!data ? <button type="button" className="quiet-button" onClick={() => setRefresh(value => value + 1)}>重試排行榜</button> : null}</div> : null}
    {!loading && data ? <>
      {data.accepted ? <p className="leaderboard-notice" role="status">成績已登錄！{data.rank === null ? '可在下方查看最新榜單。' : data.rank <= 10 ? `目前第 ${data.rank} 名。` : '目前已移出前 10 名。'}</p> : canSubmitScore ? data.eligible ? <form className="leaderboard-form" onSubmit={submit}>
        <p className="leaderboard-notice">本局暫列第 {data.rank} 名！留下你的名字。</p>
        <label htmlFor={fieldId}>排行榜名字</label>
        <div className="leaderboard-input-row"><input id={fieldId} value={name} onChange={event => setName(event.target.value)} maxLength={40} required readOnly={submittedName.current !== null} disabled={saving} autoComplete="nickname" placeholder="1–20 個字" aria-describedby={`${fieldId}-hint`} /><button type="submit" className="primary-button" disabled={saving}>{saving ? '儲存中…' : '儲存名字與成績'}</button></div>
        <small id={`${fieldId}-hint`}>名字與成績將公開顯示；送出時確認最終名次。也可以直接繼續遊玩。</small>
      </form> : <p className="leaderboard-notice" role="status">本局未進入前 10 名，再挑戰一次吧！</p> : score !== undefined ? <p>本局沒有可登錄的成績，再挑戰一次吧！</p> : null}
      {data.entries.length ? <ol className="leaderboard-list">{data.entries.map(entry => <li key={entry.rank}><span className="leaderboard-rank">{String(entry.rank).padStart(2, '0')}</span><span className="leaderboard-name" dir="auto">{entry.name}</span><strong>{entry.score} <small>{details.unit}</small></strong></li>)}</ol> : <p className="leaderboard-empty">還沒有人登榜，等你寫下第一筆紀錄。</p>}
    </> : null}
  </section>
}
