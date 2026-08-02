// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PwaUpdateNotice } from './PwaUpdateNotice'

const pwaMock = vi.hoisted(() => ({
  applyUpdate: vi.fn().mockResolvedValue(undefined),
  updateAvailable: true,
}))

vi.mock('../hooks/usePwaUpdate', () => ({
  usePwaUpdate: () => ({
    updateAvailable: pwaMock.updateAvailable,
    offlineReady: false,
    applyUpdate: pwaMock.applyUpdate,
  }),
}))

describe('PwaUpdateNotice', () => {
  it('shows the shared prompt while a game is idle and lets the player defer it', () => {
    const { container } = render(<PwaUpdateNotice isGameActive={false} />)

    expect(container.querySelector('.pwa-update')).not.toBeNull()
    const laterButton = container.querySelector<HTMLButtonElement>('.pwa-update .quiet-button')
    if (laterButton === null) throw new Error('Expected an update deferral control')
    fireEvent.click(laterButton)
    expect(container.querySelector('.pwa-update')).toBeNull()
  })

  it('does not interrupt an active game', () => {
    const { container } = render(<PwaUpdateNotice isGameActive />)
    expect(container.querySelector('.pwa-update')).toBeNull()
  })
})
