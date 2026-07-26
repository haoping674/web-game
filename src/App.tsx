import { Component, lazy, Suspense, useCallback, useEffect, useState, type ErrorInfo, type ReactNode } from 'react'
import { HomePage } from './app/HomePage'
import { GAME_REGISTRY } from './app/gameRegistry'
import { HOME_ROUTE, navigate, useAppPathname } from './app/router'
import { AppHeader } from './shared/components/AppHeader'
import { PlatformSettingsDialog } from './shared/components/PlatformSettingsDialog'
import { readAppStorage, saveAppStorage, type AppStorage, type GlobalSettings } from './shared/storage/appStorage'
import './index.css'

const FruitSumGame = lazy(() => import('./games/fruit-sum/FruitSumGame'))
const ColorLinksGame = lazy(() => import('./games/color-links/ColorLinksGame'))

type RouteErrorBoundaryProps = { children: ReactNode; onHome: () => void }
type RouteErrorBoundaryState = { failed: boolean }

class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): RouteErrorBoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Game module failed to load', error, info)
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children
    return (
      <section className="route-fallback" role="alert">
        <p className="eyebrow">LOAD INTERRUPTED</p>
        <h1>遊戲暫時無法載入</h1>
        <p>請確認網路狀態後再試一次，或先返回遊戲廳。</p>
        <button type="button" className="primary-button" onClick={() => window.location.reload()}>重新載入</button>
        <button type="button" className="text-button" onClick={this.props.onHome}>返回遊戲廳</button>
      </section>
    )
  }
}

function RouteLoading() {
  return (
    <section className="route-loading" role="status" aria-live="polite">
      <span aria-hidden="true">✦</span>
      <p>正在準備遊戲…</p>
    </section>
  )
}

function App() {
  const [pathname, go] = useAppPathname()
  const [storage, setStorage] = useState<AppStorage>(readAppStorage)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const fruitRoute = GAME_REGISTRY[0].route
  const colorRoute = GAME_REGISTRY[1].route
  const knownRoute = pathname === HOME_ROUTE || pathname === fruitRoute || pathname === colorRoute

  useEffect(() => {
    if (!knownRoute) navigate(HOME_ROUTE, { replace: true })
  }, [knownRoute])

  useEffect(() => {
    document.documentElement.dataset.effectIntensity = storage.globalSettings.effectIntensity
    return () => {
      delete document.documentElement.dataset.effectIntensity
    }
  }, [storage.globalSettings.effectIntensity])

  const refreshStorage = useCallback(() => setStorage(readAppStorage()), [])
  const updateSettings = useCallback((globalSettings: GlobalSettings) => {
    setStorage((current) => saveAppStorage({ ...current, globalSettings }))
  }, [])
  const returnHome = useCallback(() => go(HOME_ROUTE), [go])
  const openSettings = useCallback(() => {
    if (pathname !== HOME_ROUTE) window.dispatchEvent(new Event('orchard-arcade:settings-open'))
    setSettingsOpen(true)
  }, [pathname])

  if (!knownRoute) return null

  return (
    <>
      {pathname === HOME_ROUTE ? (
        <HomePage data={storage} onNavigate={go} onSettings={openSettings} />
      ) : (
        <main className="platform-shell game-route-shell">
          <AppHeader compact onHome={returnHome} onSettings={openSettings} />
          <RouteErrorBoundary key={pathname} onHome={returnHome}>
            <Suspense fallback={<RouteLoading />}>
              {pathname === fruitRoute ? (
                <FruitSumGame
                  globalSettings={storage.globalSettings}
                  onProgressChange={refreshStorage}
                  platformSettingsOpen={settingsOpen}
                />
              ) : (
                <ColorLinksGame
                  globalSettings={storage.globalSettings}
                  onProgressChange={refreshStorage}
                  platformSettingsOpen={settingsOpen}
                />
              )}
            </Suspense>
          </RouteErrorBoundary>
        </main>
      )}
      {settingsOpen ? (
        <PlatformSettingsDialog
          settings={storage.globalSettings}
          onChange={updateSettings}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
    </>
  )
}

export default App
