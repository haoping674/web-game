import { createContext, useContext, useEffect } from 'react'

export const GameActivityContext = createContext<((active: boolean) => void) | null>(null)

// Report round activity to the shared update notice, and clear it on navigation.
export function useGameActivity(active: boolean): void {
  const reportActivity = useContext(GameActivityContext)
  useEffect(() => {
    reportActivity?.(active)
    return () => reportActivity?.(false)
  }, [active, reportActivity])
}
