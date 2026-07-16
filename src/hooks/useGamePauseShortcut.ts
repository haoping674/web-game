import { useEffect } from 'react'

type GamePauseShortcutOptions = {
  isPlaying: boolean
  onPause: () => void
}

const INTERACTIVE_TARGETS = 'button, input, select, textarea, [contenteditable="true"], [role="textbox"]'

export function useGamePauseShortcut({ isPlaying, onPause }: GamePauseShortcutOptions): void {
  useEffect(() => {
    if (!isPlaying) return undefined

    const pauseOnEscape = (event: KeyboardEvent) => {
      if (
        event.key !== 'Escape'
        || event.repeat
        || event.isComposing
        || event.defaultPrevented
        || event.altKey
        || event.ctrlKey
        || event.metaKey
      ) return

      const target = event.target
      if (target instanceof Element && target.closest(INTERACTIVE_TARGETS)) return

      event.preventDefault()
      onPause()
    }

    document.addEventListener('keydown', pauseOnEscape)
    return () => document.removeEventListener('keydown', pauseOnEscape)
  }, [isPlaying, onPause])
}
