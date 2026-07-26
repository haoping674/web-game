type AppHeaderProps = {
  onHome?: () => void
  onSettings: () => void
  compact?: boolean
}

export function AppHeader({ onHome, onSettings, compact = false }: AppHeaderProps) {
  return (
    <header className={`platform-header${compact ? ' is-compact' : ''}`}>
      {onHome ? (
        <button type="button" className="platform-home-button" onClick={onHome}>
          <span aria-hidden="true">←</span> 遊戲廳
        </button>
      ) : (
        <div className="platform-wordmark"><span aria-hidden="true">✦</span><strong>Orchard Arcade</strong></div>
      )}
      <button type="button" className="platform-settings-button" onClick={onSettings}>
        共用設定
      </button>
    </header>
  )
}
