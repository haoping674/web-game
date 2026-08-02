// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GameSettings, GameStatistics } from '../game/types'
import { StartScreen } from './StartScreen'

const settings: GameSettings = { soundEnabled: true, volume: 0.45, animationsEnabled: true, animationIntensity: 'full', lowStimulus: false, hapticsEnabled: true, showSelectionHelp: true }
const statistics: GameStatistics = { highScore: 18, lastScore: 12, gamesPlayed: 2, totalCleared: 30, highestCombo: 3, totalScore: 30, bestClearsPerMinute: 18 }
const install = { canInstall: false, isInstalled: false, ios: false, onInstall: vi.fn(), onIosInstructions: vi.fn() }

afterEach(cleanup)

describe('Classic start screen', () => {
  it('shows Classic as the only available mode', () => {
    render(<StartScreen onStart={vi.fn()} settings={settings} statistics={statistics} onOpenSettings={vi.fn()} onHowToPlay={vi.fn()} onAbout={vi.fn()} install={install} />)
    expect(screen.queryByRole('radiogroup')).toBeNull()
    expect(screen.getByText('經典模式')).toBeInTheDocument()
    expect(screen.queryByText('QUICK')).toBeNull()
    expect(screen.queryByText('HARD')).toBeNull()
  })

  it('shows the Classic record and start action', () => {
    render(<StartScreen onStart={vi.fn()} settings={settings} statistics={statistics} onOpenSettings={vi.fn()} onHowToPlay={vi.fn()} onAbout={vi.fn()} install={install} />)
    expect(screen.getByText('經典最高分')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /開始經典模式/ })).toBeInTheDocument()
  })
})
