import { useCallback, useEffect, useRef, useState } from 'react'

/** Center the newly rendered board after a restart, including dialog cleanup. */
export function useBoardCentering<T extends HTMLElement = HTMLDivElement>(reducedMotion = false) {
  const containerRef = useRef<T | null>(null)
  const [request, setRequest] = useState(0)
  const centerBoard = useCallback(() => setRequest((current) => current + 1), [])

  useEffect(() => {
    if (request === 0) return undefined
    const surface = containerRef.current?.closest<HTMLElement>('.game-route-shell') ?? containerRef.current
    const previousPadding = surface?.style.paddingBottom ?? ''
    let addedSpace = false
    let frame = window.requestAnimationFrame(() => {
      const board = containerRef.current?.querySelector<HTMLElement>('[role="grid"]')
      if (!board) return
      const bounds = board.getBoundingClientRect()
      const viewport = window.visualViewport
      const start = window.scrollY
      const target = Math.max(0, start + bounds.top + bounds.height / 2 - (viewport?.height ?? window.innerHeight) / 2 - (viewport?.offsetTop ?? 0))
      const availableScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
      // Short pages need a little trailing room to reach the board's center.
      if (surface && target > availableScroll) {
        const padding = parseFloat(getComputedStyle(surface).paddingBottom) || 0
        surface.style.paddingBottom = `${padding + Math.ceil(target - availableScroll)}px`
        addedSpace = true
      }
      if (reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        window.scrollTo({ top: target, behavior: 'instant' })
        return
      }
      const startedAt = performance.now()
      const animate = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / 180)
        const eased = 1 - (1 - progress) ** 3
        window.scrollTo({ top: start + (target - start) * eased, behavior: 'instant' })
        if (progress < 1) frame = window.requestAnimationFrame(animate)
      }
      frame = window.requestAnimationFrame(animate)
    })
    return () => {
      window.cancelAnimationFrame(frame)
      if (surface && addedSpace) {
        if (previousPadding) surface.style.paddingBottom = previousPadding
        else surface.style.removeProperty('padding-bottom')
      }
    }
  }, [request, reducedMotion])

  return { containerRef, centerBoard }
}
