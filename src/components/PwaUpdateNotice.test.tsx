// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

afterEach(cleanup)

describe('PwaUpdateNotice', () => {
  it('shows the shared prompt while a game is idle and lets the player defer it', () => {
    const { baseElement } = render(<PwaUpdateNotice isGameActive={false} />)

    expect(baseElement.querySelector('.pwa-update')).not.toBeNull()
    const laterButton = baseElement.querySelector<HTMLButtonElement>('.pwa-update .quiet-button')
    if (laterButton === null) throw new Error('Expected an update deferral control')
    fireEvent.click(laterButton)
    expect(baseElement.querySelector('.pwa-update')).toBeNull()
  })

  it('keeps the notice outside transformed page containers and restores it after a round', () => {
    const view = render(<div style={{ transform: 'translateY(0)' }}><PwaUpdateNotice isGameActive={false} /></div>)
    expect(view.container.querySelector('.pwa-update')).toBeNull()
    expect(document.querySelector('.pwa-update')?.parentElement).toBe(document.body)
    view.rerender(<PwaUpdateNotice isGameActive />)
    expect(document.querySelector('.pwa-update')).toBeNull()
    view.rerender(<PwaUpdateNotice isGameActive={false} />)
    expect(document.querySelector('.pwa-update')).not.toBeNull()
  })

  it('does not interrupt an active game', () => {
    const { baseElement } = render(<PwaUpdateNotice isGameActive />)
    expect(baseElement.querySelector('.pwa-update')).toBeNull()
  })
})
