// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion') ? false : false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: vi.fn(() => null),
  })
})

beforeEach(() => {
  window.localStorage.clear()
  window.history.replaceState(null, '', '/')
})

afterEach(cleanup)

async function startColorLinks(): Promise<void> {
  fireEvent.click(await screen.findByRole('button', { name: /開始串聯/ }))
  fireEvent.click(await screen.findByRole('button', { name: '略過說明並開始' }))
}

describe('platform routing and lazy game lifecycle', () => {
  it('shows both registered games on the home page and routes each card correctly', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Orchard Ten' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Color Links' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '開始 Color Links' }))
    expect(window.location.pathname).toBe('/games/color-links')
  })

  it('opens both game URLs directly and preserves history navigation', async () => {
    window.history.replaceState(null, '', '/games/color-links')
    const view = render(<App />)
    expect(await screen.findByRole('button', { name: /開始串聯/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '遊戲廳' }))
    expect(await screen.findByRole('heading', { name: 'Color Links' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/')

    window.history.pushState(null, '', '/games/fruit-sum')
    window.dispatchEvent(new PopStateEvent('popstate'))
    expect(await screen.findByRole('button', { name: /開始經典模式/ }, { timeout: 5_000 })).toBeInTheDocument()
    view.unmount()
  })

  it('cleans the Color Links timer when returning to the home page', async () => {
    window.history.replaceState(null, '', '/games/color-links')
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout')
    render(<App />)
    await startColorLinks()
    expect(await screen.findByRole('grid', { name: 'Color Links 色彩棋盤' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '遊戲廳' }))
    await waitFor(() => expect(window.location.pathname).toBe('/'))
    expect(clearTimeoutSpy).toHaveBeenCalled()
    clearTimeoutSpy.mockRestore()
  })

  it('pauses an active game while shared settings owns focus', async () => {
    window.history.replaceState(null, '', '/games/color-links')
    render(<App />)
    await startColorLinks()
    fireEvent.click(screen.getByRole('button', { name: '共用設定' }))
    expect(screen.getByRole('dialog', { name: '共用遊戲設定' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Color Links 已暫停' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '完成' }))
    expect(screen.getByRole('dialog', { name: 'Color Links 已暫停' })).toBeInTheDocument()
  })

  it('keeps native keyboard activation for cards and shared controls', () => {
    render(<App />)
    const colorCard = screen.getByRole('button', { name: '開始 Color Links' })
    colorCard.focus()
    fireEvent.keyDown(colorCard, { key: 'Enter' })
    fireEvent.click(colorCard)
    expect(window.location.pathname).toBe('/games/color-links')
  })
})
