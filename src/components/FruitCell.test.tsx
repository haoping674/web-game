// @vitest-environment jsdom
import { act, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FruitCell } from './FruitCell'

afterEach(() => {
  vi.useRealTimers()
})

describe('FruitCell clearing animation', () => {
  it('does not replay an already-cleared fruit when a later effect changes', () => {
    vi.useFakeTimers()
    const { container, rerender } = render(<FruitCell value={4} index={0} clearEffectId={1} clearDurationMs={100} />)

    rerender(<FruitCell value={null} index={0} clearEffectId={1} clearDurationMs={100} />)
    expect(container.querySelector('.is-clearing')).not.toBeNull()

    act(() => vi.runAllTimers())
    expect(container.querySelector('.is-empty')).not.toBeNull()

    rerender(<FruitCell value={null} index={0} clearEffectId={undefined} clearDurationMs={100} />)
    expect(container.querySelector('.is-empty')).not.toBeNull()
    expect(container.querySelector('.fruit-value')).toBeNull()
  })
})
