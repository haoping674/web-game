// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PauseDialog } from './PauseDialog'

afterEach(() => {
  cleanup()
  document.querySelectorAll('[data-test-outside]').forEach((element) => element.remove())
})

describe('PauseDialog', () => {
  it('announces the paused state and initially focuses resume', async () => {
    render(<PauseDialog onResume={vi.fn()} onRestart={vi.fn()} onHome={vi.fn()} />)
    expect(screen.getByRole('dialog', { name: '遊戲已暫停' })).toBeInTheDocument()
    const resume = screen.getByRole('button', { name: '繼續遊戲' })
    await waitFor(() => expect(resume).toHaveFocus())
  })

  it('resumes with Escape without treating a backdrop click as resume', async () => {
    const onResume = vi.fn()
    const { container } = render(<PauseDialog onResume={onResume} onRestart={vi.fn()} onHome={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole('button', { name: '繼續遊戲' })).toHaveFocus())
    fireEvent.mouseDown(container.querySelector('.dialog-backdrop')!)
    expect(onResume).not.toHaveBeenCalled()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onResume).toHaveBeenCalledOnce()
  })

  it('contains focus inside the topmost pause dialog', async () => {
    const outside = document.createElement('button')
    outside.dataset.testOutside = 'true'
    document.body.append(outside)
    render(<PauseDialog onResume={vi.fn()} onRestart={vi.fn()} onHome={vi.fn()} />)
    const resume = screen.getByRole('button', { name: '繼續遊戲' })
    await waitFor(() => expect(resume).toHaveFocus())
    outside.focus()
    await waitFor(() => expect(resume).toHaveFocus())
    outside.remove()
  })
})
