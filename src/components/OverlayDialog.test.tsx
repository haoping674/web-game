// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OverlayDialog } from './OverlayDialog'

afterEach(cleanup)

describe('shared overlay accessibility', () => {
  it('does not restore an inert flag owned by the game after resume', () => {
    const view = render(<><section inert><button>Paused game</button></section><OverlayDialog label="Pause"><button>Resume</button></OverlayDialog></>)
    const section = screen.getByText('Paused game').parentElement!
    view.rerender(<section inert={false}><button>Paused game</button></section>)
    expect(section.inert).toBeFalsy()
  })
  it('isolates background controls and restores their original inert state', () => {
    const { rerender, unmount } = render(<><main><button>Outside</button></main><OverlayDialog label="First"><button>Inside</button></OverlayDialog></>)
    const main = screen.getByRole('main', { hidden: true })
    expect(main.inert).toBe(true)
    rerender(<><main><button>Outside</button></main><OverlayDialog label="First"><button>Inside</button></OverlayDialog><OverlayDialog label="Second"><button>Top</button></OverlayDialog></>)
    expect(screen.getByRole('dialog', { name: 'First', hidden: true }).parentElement!.inert).toBe(true)
    rerender(<><main><button>Outside</button></main><OverlayDialog label="First"><button>Inside</button></OverlayDialog></>)
    expect(main.inert).toBe(true)
    expect(screen.getByRole('dialog', { name: 'First' }).parentElement!.inert).toBe(false)
    unmount()
    expect(main.inert).toBe(false)
  })

  it('wraps from a closed disclosure, skipping its hidden content', async () => {
    render(<OverlayDialog label="Results"><button>Replay</button><details><summary>Leaderboard</summary><input aria-label="Nickname" /></details></OverlayDialog>)
    const replay = screen.getByRole('button', { name: 'Replay' })
    await waitFor(() => expect(replay).toHaveFocus())
    const summary = screen.getByText('Leaderboard')
    summary.focus()
    fireEvent.keyDown(summary, { key: 'Tab' })
    expect(replay).toHaveFocus()
  })

  it('does not reset focus when callbacks change and uses the latest Escape action', async () => {
    const first = vi.fn(), latest = vi.fn()
    const view = render(<OverlayDialog label="Settings" onClose={first}><button>Last</button></OverlayDialog>)
    await waitFor(() => expect(screen.getByRole('button', { name: '關閉對話框' })).toHaveFocus())
    const last = screen.getByRole('button', { name: 'Last' })
    last.focus()
    view.rerender(<OverlayDialog label="Settings" onClose={latest}><button>Last</button></OverlayDialog>)
    expect(last).toHaveFocus()
    fireEvent.keyDown(last, { key: 'Escape', isComposing: true })
    expect(latest).not.toHaveBeenCalled()
    fireEvent.keyDown(last, { key: 'Escape' })
    expect(latest).toHaveBeenCalledOnce()
    expect(first).not.toHaveBeenCalled()
  })

  it('keeps a dialog without interactive content focusable', async () => {
    render(<OverlayDialog label="Notice"><p>Notice</p></OverlayDialog>)
    const dialog = screen.getByRole('dialog', { name: 'Notice' })
    await waitFor(() => expect(dialog).toHaveFocus())
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(dialog).toHaveFocus()
  })
})
