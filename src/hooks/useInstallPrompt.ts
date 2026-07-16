import { useCallback, useEffect, useState } from 'react'

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
const DISMISS_KEY = 'orchard-ten-install-dismissed-at'

function isIos(): boolean { return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as Window & { MSStream?: unknown }).MSStream }
function isStandalone(): boolean { return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true }

export function useInstallPrompt(): { canInstall: boolean; isInstalled: boolean; ios: boolean; showIosInstructions: boolean; install: () => Promise<void>; openIosInstructions: () => void; closeIosInstructions: () => void } {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null)
  const [isInstalled, setInstalled] = useState(isStandalone)
  const [showIosInstructions, setShowIosInstructions] = useState(false)
  useEffect(() => {
    const capture = (event: Event): void => {
      event.preventDefault()
      const dismissedAt = Number(window.localStorage.getItem(DISMISS_KEY) ?? '0')
      if (Date.now() - dismissedAt > 7 * 24 * 60 * 60 * 1_000) setPromptEvent(event as InstallPromptEvent)
    }
    const installed = (): void => { setInstalled(true); setPromptEvent(null); window.localStorage.removeItem(DISMISS_KEY) }
    window.addEventListener('beforeinstallprompt', capture)
    window.addEventListener('appinstalled', installed)
    return () => { window.removeEventListener('beforeinstallprompt', capture); window.removeEventListener('appinstalled', installed) }
  }, [])
  const install = useCallback(async (): Promise<void> => {
    if (!promptEvent) return
    await promptEvent.prompt()
    const choice = await promptEvent.userChoice
    if (choice.outcome === 'dismissed') window.localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setPromptEvent(null)
  }, [promptEvent])
  return { canInstall: Boolean(promptEvent) || (!isInstalled && isIos()), isInstalled, ios: isIos(), showIosInstructions, install, openIosInstructions: () => setShowIosInstructions(true), closeIosInstructions: () => setShowIosInstructions(false) }
}
