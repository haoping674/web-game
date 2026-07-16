// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PauseDialog } from './PauseDialog'

describe('PauseDialog', () => {
  it('announces the paused state and initially focuses resume', async () => {
    render(<PauseDialog onResume={vi.fn()} onRestart={vi.fn()} onHome={vi.fn()} />)
    expect(screen.getByRole('dialog', { name: '遊戲已暫停' })).toBeInTheDocument()
    const resume = screen.getByRole('button', { name: '繼續遊戲' })
    await waitFor(() => expect(resume).toHaveFocus())
  })
})
