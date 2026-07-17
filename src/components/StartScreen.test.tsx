// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GameSettings, GameStatistics } from '../game/types'
import { StartScreen } from './StartScreen'

const settings: GameSettings = { soundEnabled: true, volume: 0.45, animationsEnabled: true, animationIntensity: 'full', lowStimulus: false, hapticsEnabled: true, showSelectionHelp: true }
const statistics: GameStatistics = { highScore: 18, lastScore: 12, gamesPlayed: 2, totalCleared: 30, highestCombo: 3, totalScore: 30, bestClearsPerMinute: 18 }
const install = { canInstall: false, isInstalled: false, ios: false, onInstall: vi.fn(), onIosInstructions: vi.fn() }

afterEach(cleanup)

describe('mode selection', () => {
  it('offers only the three released modes and reports changes', () => {
    const onModeChange = vi.fn()
    render(<StartScreen selectedMode="classic" onModeChange={onModeChange} onStart={vi.fn()} settings={settings} statistics={statistics} onOpenSettings={vi.fn()} onHowToPlay={vi.fn()} onAbout={vi.fn()} install={install} />)
    expect(screen.getAllByRole('radio')).toHaveLength(3)
    expect(screen.queryByRole('radio', { name: /Zen/i })).toBeNull()
    fireEvent.click(screen.getByRole('radio', { name: /快速/ }))
    expect(onModeChange).toHaveBeenCalledWith('quick')
  })

  it('shows the selected mode record and start action', () => {
    render(<StartScreen selectedMode="hard" onModeChange={vi.fn()} onStart={vi.fn()} settings={settings} statistics={statistics} onOpenSettings={vi.fn()} onHowToPlay={vi.fn()} onAbout={vi.fn()} install={install} />)
    expect(screen.getByRole('radio', { name: /困難/ })).toBeChecked()
    expect(screen.getByRole('button', { name: /開始困難模式/ })).toBeInTheDocument()
    expect(screen.getByText('困難最高分')).toBeInTheDocument()
  })
})
