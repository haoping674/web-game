const UPDATE_INTERVAL_MS = 60_000
const MIN_CHECK_GAP_MS = 10_000

export function startPwaUpdateChecks(registration: ServiceWorkerRegistration): () => void {
  let checking = false
  let lastCheck = -Infinity

  const checkForUpdate = async (): Promise<void> => {
    if (document.visibilityState !== 'visible' || !navigator.onLine
      || !registration.active || registration.installing || registration.waiting
      || checking || Date.now() - lastCheck < MIN_CHECK_GAP_MS) return

    checking = true
    lastCheck = Date.now()
    try {
      await registration.update()
    } catch (error: unknown) {
      console.warn('PWA update check failed', error)
    } finally {
      checking = false
    }
  }

  const requestCheck = (): void => { void checkForUpdate() }
  const interval = window.setInterval(requestCheck, UPDATE_INTERVAL_MS)
  document.addEventListener('visibilitychange', requestCheck)
  window.addEventListener('focus', requestCheck)
  window.addEventListener('online', requestCheck)
  window.addEventListener('pageshow', requestCheck)
  requestCheck()

  return () => {
    window.clearInterval(interval)
    document.removeEventListener('visibilitychange', requestCheck)
    window.removeEventListener('focus', requestCheck)
    window.removeEventListener('online', requestCheck)
    window.removeEventListener('pageshow', requestCheck)
  }
}
