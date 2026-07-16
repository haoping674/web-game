import { useSyncExternalStore } from 'react'
import { applyPwaUpdate, getPwaSnapshot, subscribePwa } from '../pwa'

export function usePwaUpdate(): { updateAvailable: boolean; offlineReady: boolean; applyUpdate: () => Promise<void> } {
  const snapshot = useSyncExternalStore(subscribePwa, getPwaSnapshot, getPwaSnapshot)
  return { ...snapshot, applyUpdate: applyPwaUpdate }
}
