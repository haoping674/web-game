// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { InstallAppButton } from './InstallAppButton'

describe('InstallAppButton', () => {
  it('hides after installation and opens iOS instructions instead of a native prompt', () => {
    const install = vi.fn().mockResolvedValue(undefined)
    const iosInstructions = vi.fn()
    const { rerender } = render(<InstallAppButton canInstall isInstalled={false} ios onInstall={install} onIosInstructions={iosInstructions} />)
    fireEvent.click(screen.getByRole('button'))
    expect(iosInstructions).toHaveBeenCalledOnce()
    expect(install).not.toHaveBeenCalled()
    rerender(<InstallAppButton canInstall isInstalled ios={false} onInstall={install} onIosInstructions={iosInstructions} />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
