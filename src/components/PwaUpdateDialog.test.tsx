// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PwaUpdateDialog } from './PwaUpdateDialog'

describe('PwaUpdateDialog', () => {
  it('defers the prompt while a round is active', () => {
    render(<PwaUpdateDialog visible isGameActive onUpdate={vi.fn()} onLater={vi.fn()} />)
    expect(screen.queryByText('有新版本可更新')).toBeNull()
  })

  it('only runs an update after a player chooses it', () => {
    const update = vi.fn().mockResolvedValue(undefined)
    render(<PwaUpdateDialog visible isGameActive={false} onUpdate={update} onLater={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '立即更新' }))
    expect(update).toHaveBeenCalledOnce()
  })
})
