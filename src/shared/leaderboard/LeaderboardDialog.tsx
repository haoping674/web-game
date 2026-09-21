import { useState } from 'react'
import { OverlayDialog } from '../../components/OverlayDialog'
import { BOARDS, isBoardId } from './boards'
import type { BoardId } from './boards'
import { LeaderboardPanel } from './LeaderboardPanel'

export function LeaderboardDialog({ onClose }: { onClose: () => void }) {
  const [board, setBoard] = useState<BoardId>('fruit-classic')
  return <OverlayDialog label="線上排行榜" onClose={onClose}>
    <p className="eyebrow">ORCHARD ARCADE · TOP 10</p><h2>線上排行榜</h2>
    <label className="leaderboard-selector">選擇榜單<select value={board} onChange={event => { if (isBoardId(event.target.value)) setBoard(event.target.value) }}>{Object.entries(BOARDS).map(([id, details]) => <option key={id} value={id}>{details.title}</option>)}</select></label>
    <LeaderboardPanel key={board} board={board} />
  </OverlayDialog>
}
