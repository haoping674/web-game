// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { usePageVisibilityPause } from './usePageVisibilityPause'

function Harness({ isPlaying, onPause }: { isPlaying: boolean; onPause: () => void }) {
  usePageVisibilityPause({ isPlaying, onPause })
  return null
}

const setVisibility = (visibilityState: DocumentVisibilityState) => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: visibilityState })
}

afterEach(() => setVisibility('visible'))

describe('usePageVisibilityPause', () => {
  it('pauses immediately when the document becomes hidden and never resumes on visible', () => {
    setVisibility('visible')
    const onPause = vi.fn()
    const { rerender } = render(<Harness isPlaying onPause={onPause} />)
    setVisibility('hidden')
    fireEvent(document, new Event('visibilitychange'))
    expect(onPause).toHaveBeenCalledOnce()
    rerender(<Harness isPlaying={false} onPause={onPause} />)
    setVisibility('visible')
    fireEvent(document, new Event('visibilitychange'))
    expect(onPause).toHaveBeenCalledOnce()
  })

  it('also pauses a playing page before it enters the back-forward cache', () => {
    setVisibility('visible')
    const onPause = vi.fn()
    render(<Harness isPlaying onPause={onPause} />)
    fireEvent(window, new PageTransitionEvent('pagehide', { persisted: true }))
    expect(onPause).toHaveBeenCalledOnce()
  })

  it('coalesces visibilitychange and pagehide into one pause request', () => {
    setVisibility('visible')
    const onPause = vi.fn()
    render(<Harness isPlaying onPause={onPause} />)
    setVisibility('hidden')
    fireEvent(document, new Event('visibilitychange'))
    fireEvent(window, new PageTransitionEvent('pagehide'))
    expect(onPause).toHaveBeenCalledOnce()
  })
})
