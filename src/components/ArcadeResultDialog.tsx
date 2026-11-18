import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { ArcadeShareResult } from '../share/types'
import { RESULT_THEMES } from '../share/resultThemes'
import { useShareResult } from '../share/useShareResult'
import { OverlayDialog } from './OverlayDialog'
import { ShareResultContent } from './ShareResultDialog'
import { translate } from '../app/translate'
import './arcade-result.css'
import { navigate } from '../app/router'
import { localizedPath, SITE_NAMES } from '../app/locale'
import { createPortal } from 'react-dom'

export function ArcadeResultDialog({ result, onReplay, onClose, onHome, children, label, replayHint }: {
  result: ArcadeShareResult
  onReplay: () => void
  onClose?: () => void
  onHome?: () => void
  children?: ReactNode
  label?: string
  replayHint?: string
}) {
  const [shareOpen, setShareOpen] = useState(false)
  const shareButton = useRef<HTMLButtonElement>(null)
  const share = useShareResult(result)
  const { preparePreview } = share
  const english = result.locale === 'en'
  const theme = RESULT_THEMES[result.gameId]
  useEffect(() => { void preparePreview() }, [preparePreview])
  const closeShare = useCallback(() => {
    setShareOpen(false)
    requestAnimationFrame(() => shareButton.current?.focus())
  }, [])

  return createPortal(<div className="arcade-result-layer">
    <div>
    <OverlayDialog label={label ?? (english ? 'Round results' : '本局結算')} onClose={onClose}>
      <div className="arcade-result" style={{ '--result-accent': theme.accent, '--result-tint': theme.tint } as CSSProperties}>
        <p className="eyebrow">{result.gameName}</p>
        <h2>{result.headline}</h2>
        <div className={`arcade-result-ticket result-${result.gameId}`}>
          <span className="result-ticket-mark" aria-hidden="true">{theme.mark}</span>
          <span className="result-ticket-badge">{result.newBest ? (english ? '↗ Personal best' : '↗ 個人新紀錄') : (english ? 'Round complete' : '挑戰完成')}</span>
          <p>{result.metricLabel}</p>
          <strong className="result-ticket-number">{result.value}<small>{result.unit}</small></strong>
          <span className="result-ticket-rule" aria-hidden="true" />
          <span className="result-ticket-signature">{SITE_NAMES[result.locale]}</span>
        </div>
        <dl className="arcade-result-stats">{result.stats.map(stat => <div key={stat.label}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>)}</dl>
        {replayHint && <p className="result-replay-hint">{replayHint}</p>}
        <div className="arcade-result-actions">
          <button type="button" className="primary-button" onClick={onReplay}>{english ? 'Play again' : '再玩一次'} <span aria-hidden="true">↗</span></button>
          <button ref={shareButton} type="button" className="quiet-button share-button" onClick={() => setShareOpen(true)}>{english ? 'Share results' : '分享成績'} <span aria-hidden="true">↗</span></button>
          <button type="button" className="text-button" disabled={share.isGenerating} onClick={() => void share.download()}>{share.isGenerating ? (english ? 'Preparing card…' : '圖卡準備中…') : (english ? 'Download result card' : '下載成果圖卡')} <span aria-hidden="true">↓</span></button>
          <button type="button" className="text-button" onClick={onHome ?? (() => navigate(localizedPath('/', result.locale)))}>{onHome ? (english ? 'Back to start' : '回到首頁') : (english ? 'Back to games' : '返回遊戲廳')}</button>
        </div>
        {share.status && <p className="share-status" role="status">{translate(share.status.message)}</p>}
        {children && <details className="result-leaderboard"><summary>{english ? 'Online leaderboard' : '線上排行榜'}</summary>{children}</details>}
      </div>
    </OverlayDialog>
    </div>
    {shareOpen && <ShareResultContent result={result} share={share} onClose={closeShare} />}
  </div>, document.body)
}
