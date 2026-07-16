import { useEffect } from 'react'

type PageVisibilityPauseOptions = {
  isPlaying: boolean
  onPause: () => void
}

export function usePageVisibilityPause({ isPlaying, onPause }: PageVisibilityPauseOptions): void {
  useEffect(() => {
    if (!isPlaying) return undefined

    const pauseWhenHidden = () => {
      if (document.visibilityState === 'hidden') onPause()
    }
    const pauseOnPageHide = () => onPause()

    document.addEventListener('visibilitychange', pauseWhenHidden)
    window.addEventListener('pagehide', pauseOnPageHide)
    pauseWhenHidden()

    return () => {
      document.removeEventListener('visibilitychange', pauseWhenHidden)
      window.removeEventListener('pagehide', pauseOnPageHide)
    }
  }, [isPlaying, onPause])
}
