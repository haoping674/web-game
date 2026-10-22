type AppHeaderProps = {
  onHome?: () => void
  onSettings: () => void
  compact?: boolean
}

export function AppHeader({ onHome, onSettings, compact = false }: AppHeaderProps) {
  return (
    <header className={`platform-header${compact ? ' is-compact' : ''}`}>
      <div className="platform-wordmark"><span aria-hidden="true">✦</span><strong>Orchard Arcade</strong></div>
      <div className="platform-header-actions">
        {onHome ? (
          <button type="button" className="platform-home-button" onClick={onHome}>
            <span aria-hidden="true">←</span> 遊戲廳
          </button>
        ) : null}
        <button type="button" className="platform-settings-button" onClick={onSettings}>
          共用設定
        </button>
      </div>
    </header>
  )
}
