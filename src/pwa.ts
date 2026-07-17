type PwaSnapshot = { updateAvailable: boolean; offlineReady: boolean }

let snapshot: PwaSnapshot = { updateAvailable: false, offlineReady: false }
let updateServiceWorker: ((reloadPage?: boolean) => Promise<void>) | undefined
let initializationStarted = false
const subscribers = new Set<() => void>()

function emit(next: Partial<PwaSnapshot>): void {
  snapshot = { ...snapshot, ...next }
  subscribers.forEach((listener) => listener())
}

export function initializePwa(): void {
  if (import.meta.env.DEV || !('serviceWorker' in navigator) || initializationStarted) return
  initializationStarted = true
  void import('./pwaRegisterProduction').then(({ registerProductionServiceWorker }) => {
    updateServiceWorker = registerProductionServiceWorker({
      immediate: true,
      onNeedRefresh: () => emit({ updateAvailable: true }),
      onOfflineReady: () => emit({ offlineReady: true }),
      onRegisterError: (error) => console.warn('PWA service worker registration failed', error),
    })
  }).catch((error: unknown) => console.warn('PWA registration module failed to load', error))
}

export function getPwaSnapshot(): PwaSnapshot { return snapshot }
export function subscribePwa(listener: () => void): () => void { subscribers.add(listener); return () => subscribers.delete(listener) }
export async function applyPwaUpdate(): Promise<void> { await updateServiceWorker?.(true) }
