import { useEffect, useState } from 'react'

export type NetworkNotice = 'offline' | 'restored' | null

export function useNetworkStatus(): NetworkNotice {
  const [notice, setNotice] = useState<NetworkNotice>(() => navigator.onLine ? null : 'offline')
  useEffect(() => {
    let timeout: number | undefined
    const offline = (): void => { if (timeout) window.clearTimeout(timeout); setNotice('offline') }
    const online = (): void => {
      setNotice('restored')
      timeout = window.setTimeout(() => setNotice(null), 4_500)
    }
    window.addEventListener('offline', offline)
    window.addEventListener('online', online)
    return () => { window.removeEventListener('offline', offline); window.removeEventListener('online', online); if (timeout) window.clearTimeout(timeout) }
  }, [])
  return notice
}
