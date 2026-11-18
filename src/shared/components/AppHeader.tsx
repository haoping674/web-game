import { translate } from '../../app/translate'
import { readAppPathname, toAppUrl } from '../../app/router'
import { ENGLISH_GAME_IDS, SITE_NAMES, localeFromPath, localizedPath, withoutLocale } from '../../app/locale'
import { GAME_REGISTRY } from '../../app/gameRegistry'
type AppHeaderProps = {
  onHome?: () => void
  onSettings: () => void
  compact?: boolean
}

export function AppHeader({ onHome, onSettings, compact = false }: AppHeaderProps) {
  const path = readAppPathname()
  const locale = localeFromPath(path)
  const english = locale === 'en'
  const route = withoutLocale(path)
  const canSwitch = route === '/' || GAME_REGISTRY.some(game => game.route === route && ENGLISH_GAME_IDS.some(id => id === game.id))
  return (
    <header className={`platform-header${compact ? ' is-compact' : ''}`}>
      <div className="platform-wordmark"><span aria-hidden="true">✦</span><strong>{SITE_NAMES[locale]}</strong></div>
      <div className="platform-header-actions">
        {canSwitch && (
          <nav className="language-switch" aria-label={english ? 'Language' : '語言切換'}>
            <a className="language-switch-option" href={toAppUrl(localizedPath(path, 'zh-Hant'))} lang="zh-Hant" hrefLang="zh-Hant" aria-label="繁體中文" aria-current={!english ? 'page' : undefined}>繁中</a>
            <a className="language-switch-option" href={toAppUrl(localizedPath(path, 'en'))} lang="en" hrefLang="en" aria-label="English" aria-current={english ? 'page' : undefined}>EN</a>
          </nav>
        )}
        {onHome ? (
          <button type="button" className="platform-home-button" onClick={onHome}>
            <span aria-hidden="true">←</span> {english ? 'Games' : translate('遊戲廳')}
          </button>
        ) : null}
        <button type="button" className="platform-settings-button" onClick={onSettings}>
          {translate('共用設定')}
        </button>
      </div>
    </header>
  )
}
