// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useBoardCentering } from './useBoardCentering'

function Harness({ reducedMotion = false }: { reducedMotion?: boolean }) {
  const { containerRef, centerBoard } = useBoardCentering(reducedMotion)
  return <div ref={containerRef}><button onClick={centerBoard}>Restart</button><div role="grid" /></div>
}

afterEach(() => { cleanup(); vi.restoreAllMocks() })

function setup(reducedMotion = false) {
  const frames = new Map<number, FrameRequestCallback>()
  let id = 0
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => { frames.set(++id, callback); return id })
  const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((key) => { frames.delete(key) })
  const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn(() => ({ matches: false })) })
  vi.spyOn(window, 'scrollY', 'get').mockReturnValue(100)
  vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(800)
  vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(3_000)
  const view = render(<Harness reducedMotion={reducedMotion} />)
  vi.spyOn(view.getByRole('grid'), 'getBoundingClientRect').mockReturnValue({ top: 500, height: 200 } as DOMRect)
  const flush = (now: number) => act(() => {
    const callbacks = [...frames.values()]
    frames.clear()
    callbacks.forEach((callback) => callback(now))
  })
  return { ...view, scroll, cancel, frames, flush }
}

describe('board centering after restart', () => {
  it('waits for restart and the rendered board, then centers without motion when reduced', () => {
    const { getByRole, scroll, flush } = setup(true)
    expect(scroll).not.toHaveBeenCalled()
    fireEvent.click(getByRole('button'))
    expect(scroll).not.toHaveBeenCalled()
    flush(0)
    expect(scroll).toHaveBeenCalledWith({ top: 300, behavior: 'instant' })
  })

  it('finishes the quick scroll at the board center', () => {
    const { getByRole, scroll, flush } = setup()
    fireEvent.click(getByRole('button'))
    flush(0)
    flush(performance.now() + 200)
    expect(scroll).toHaveBeenLastCalledWith({ top: 300, behavior: 'instant' })
  })

  it('adds and cleans up trailing space when the page would clamp the scroll', () => {
    const { getByRole, scroll, flush, container, unmount } = setup(true)
    vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(900)
    fireEvent.click(getByRole('button'))
    flush(0)
    expect(container.firstElementChild?.getAttribute('style')).toContain('padding-bottom: 200px')
    expect(scroll).toHaveBeenCalledWith({ top: 300, behavior: 'instant' })
    const surface = container.firstElementChild as HTMLElement
    unmount()
    expect(surface.style.paddingBottom).toBe('')
  })

  it('cancels pending motion when unmounted', () => {
    const { getByRole, unmount, frames, cancel, scroll } = setup()
    fireEvent.click(getByRole('button'))
    expect(frames.size).toBe(1)
    unmount()
    expect(cancel).toHaveBeenCalled()
    expect(frames.size).toBe(0)
    expect(scroll).not.toHaveBeenCalled()
  })
})
