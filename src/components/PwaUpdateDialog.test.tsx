// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PwaUpdateDialog } from './PwaUpdateDialog'
import { OverlayDialog } from './OverlayDialog'

afterEach(cleanup)

describe('PwaUpdateDialog', () => {
  it('defers the prompt while a round is active', () => {
    render(<PwaUpdateDialog visible isGameActive onUpdate={vi.fn()} onLater={vi.fn()} />)
    expect(screen.queryByText('有新版本可更新')).toBeNull()
  })

  it('keeps update controls keyboard-accessible while a non-game dialog is open', () => {
    render(<>
      <OverlayDialog label="設定"><button type="button">完成</button></OverlayDialog>
      <PwaUpdateDialog visible isGameActive={false} onUpdate={vi.fn()} onLater={vi.fn()} />
    </>)
    const update = screen.getByRole('button', { name: '立即更新' })
    update.focus()
    expect(document.activeElement).toBe(update)
    fireEvent.keyDown(update, { key: 'Tab' })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '完成' }))
  })

  it('only runs an update after a player chooses it', () => {
    const update = vi.fn().mockResolvedValue(undefined)
    render(<PwaUpdateDialog visible isGameActive={false} onUpdate={update} onLater={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '立即更新' }))
    expect(update).toHaveBeenCalledOnce()
  })
})
