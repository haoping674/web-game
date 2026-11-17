import { useEffect, useRef } from 'react'

// Lazy routes may mount their heading after the route effect has run.
export function useRouteFocus(pathname: string): void {
  const previous = useRef(pathname)
  useEffect(() => {
    if (previous.current === pathname) return
    previous.current = pathname
    const focusHeading = () => {
      const heading = document.querySelector<HTMLElement>('main h1')
      if (!heading) return false
      heading.tabIndex = -1
      heading.focus({ preventScroll: true })
      heading.scrollIntoView?.({ block: 'start', behavior: 'instant' })
      return true
    }
    if (focusHeading()) return
    const observer = new MutationObserver(() => { if (focusHeading()) observer.disconnect() })
    observer.observe(document.getElementById('root') ?? document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [pathname])
}
