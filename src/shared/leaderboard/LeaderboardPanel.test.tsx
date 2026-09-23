// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LeaderboardPanel } from './LeaderboardPanel'

const fetchMock = vi.fn()
const qualified = { entries: [], rank: 1, eligible: true }
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status })
beforeEach(() => { localStorage.clear(); vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset() })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('result leaderboard', () => {
  it('allows a qualifying player to save a name and score once', async () => {
    fetchMock.mockResolvedValueOnce(reply(qualified)).mockResolvedValueOnce(reply({ accepted: true, rank: 1, eligible: true, entries: [{ rank: 1, name: '小芽', score: 50 }] }))
    render(<LeaderboardPanel board="fruit-classic" score={50} />)
    fireEvent.change(await screen.findByRole('textbox', { name: '排行榜名字' }), { target: { value: ' 小芽 ' } })
    fireEvent.click(screen.getByRole('button', { name: '儲存名字與成績' }))
    expect(await screen.findByText('成績已登錄！目前第 1 名。')).toBeInTheDocument()
    const body = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(body).toMatchObject({ board: 'fruit-classic', score: 50, name: '小芽' })
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(localStorage.getItem('orchard-leaderboard-name')).toBe('小芽')
  })
  it('shows standings without a name form when outside the top ten', async () => {
    fetchMock.mockResolvedValue(reply({ ...qualified, rank: 11, eligible: false }))
    render(<LeaderboardPanel board="fruit-classic" score={40} />)
    expect(await screen.findByText(/本局未進入前 10 名/)).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })
  it('handles being overtaken during entry without claiming success', async () => {
    fetchMock.mockResolvedValueOnce(reply(qualified)).mockResolvedValueOnce(reply({ ...qualified, accepted: false, eligible: false, rank: 11 }))
    render(<LeaderboardPanel board="fruit-classic" score={40} />)
    fireEvent.change(await screen.findByRole('textbox'), { target: { value: '玩家' } })
    fireEvent.click(screen.getByRole('button', { name: '儲存名字與成績' }))
    expect(await screen.findByText(/本局未進入前 10 名/)).toBeInTheDocument()
    expect(screen.queryByText(/成績已登錄/)).not.toBeInTheDocument()
  })
  it('recovers from offline loading and preserves the id and name on ambiguous save retries', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(reply(qualified)).mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(reply({ ...qualified, accepted: true }))
    render(<LeaderboardPanel board="color-time" score={12} />)
    fireEvent.click(await screen.findByRole('button', { name: '重試排行榜' }))
    fireEvent.change(await screen.findByRole('textbox'), { target: { value: '測試者' } })
    fireEvent.click(screen.getByRole('button', { name: '儲存名字與成績' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('不會重複登錄')
    fireEvent.click(screen.getByRole('button', { name: '儲存名字與成績' }))
    await screen.findByText(/成績已登錄/)
    expect(fetchMock.mock.calls[2][1].body).toBe(fetchMock.mock.calls[3][1].body)
  })
  it('allows zero-point rounds and zero-second Color Links finishes when qualified', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(reply(qualified)))
    const first = render(<LeaderboardPanel board="fruit-classic" score={0} />)
    expect(await screen.findByRole('textbox')).toBeInTheDocument()
    expect(fetchMock.mock.calls[0][0]).toContain('score=0')
    first.unmount()
    render(<LeaderboardPanel board="color-time" score={0} />)
    expect(await screen.findByRole('textbox')).toBeInTheDocument()
    expect(fetchMock.mock.calls[1][0]).toContain('score=0')
  })
  it('reuses the id after reopening a saved result', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(reply(qualified)))
    const first = render(<LeaderboardPanel board="fruit-classic" score={5} resultKey="fruit-run-one" />)
    await screen.findByRole('textbox')
    const stored = localStorage.getItem('orchard-leaderboard-last-result')
    first.unmount()
    render(<LeaderboardPanel board="fruit-classic" score={5} resultKey="fruit-run-one" />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(localStorage.getItem('orchard-leaderboard-last-result')).toBe(stored)
  })
  it('remembers a saved result even if another game changes the preferred nickname', async () => {
    fetchMock.mockResolvedValueOnce(reply(qualified)).mockResolvedValueOnce(reply({ ...qualified, accepted: true })).mockResolvedValueOnce(reply(qualified))
    const first = render(<LeaderboardPanel board="fruit-classic" score={5} resultKey="completed-run" />)
    fireEvent.change(await screen.findByRole('textbox'), { target: { value: '原本名字' } })
    fireEvent.click(screen.getByRole('button', { name: '儲存名字與成績' }))
    await screen.findByText(/成績已登錄/)
    first.unmount()
    localStorage.setItem('orchard-leaderboard-name', '別局名字')
    render(<LeaderboardPanel board="fruit-classic" score={5} resultKey="completed-run" />)
    expect(await screen.findByText('成績已登錄！可在下方查看最新榜單。')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })
})
