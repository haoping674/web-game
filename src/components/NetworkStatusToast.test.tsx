// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { useNetworkStatus } from '../hooks/useNetworkStatus'
import { NetworkStatusToast } from './NetworkStatusToast'
import { afterEach, describe, expect, it, vi } from 'vitest'

function NetworkProbe() {
  return <NetworkStatusToast notice={useNetworkStatus()} />
}

describe('network status feedback', () => {
  afterEach(() => vi.useRealTimers())

  it('announces offline and automatically clears the restored notice', () => {
    vi.useFakeTimers()
    render(<NetworkProbe />)
    fireEvent(window, new Event('offline'))
    expect(screen.getByRole('status').textContent).toContain('\u96e2\u7dda')
    fireEvent(window, new Event('online'))
    expect(screen.getByRole('status').textContent).toContain('\u6062\u5fa9\u9023\u7dda')
    act(() => vi.advanceTimersByTime(4_500))
    expect(screen.queryByRole('status')).toBeNull()
  })
})
