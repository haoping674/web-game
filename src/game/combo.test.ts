import { describe, expect, it } from 'vitest'
import { getComboWindowMs } from './comboConfig'
import { resolveEffectLevel } from './comboEffects'
import { getNextGameWakeDelay } from './comboTimer'
import { getComboRating, getComboTier, getComboTitle, isComboMilestone } from './comboTier'
import { defaultSettings } from './storage'
import { getComboSoundProfile } from './soundManager'

describe('mode Combo configuration', () => {
  it('uses the configured Classic Combo windows', () => {
    expect([1, 3, 6, 10].map((combo) => getComboWindowMs('classic', combo))).toEqual([8_000, 7_200, 6_400, 5_600])
  })

  it('wakes exactly for either the round tick or Combo expiry', () => {
    expect(getNextGameWakeDelay(2_000, 1_500, 1_000)).toBe(501)
    expect(getNextGameWakeDelay(1_200, 1_500, 1_000)).toBe(200)
    expect(getNextGameWakeDelay(null, null, 1_000)).toBeNull()
  })
})

describe('Combo feedback tiers', () => {
  it('maps every boundary to the correct tier and title', () => {
    expect([0, 2, 3, 5, 6, 9, 10, 20].map(getComboTier)).toEqual(['base', 'base', 'rising', 'rising', 'charged', 'charged', 'legendary', 'orchard'])
    expect(getComboTitle(9)).toBeNull()
    expect(getComboTitle(10)).toBe('Fruit Flow')
    expect(getComboTitle(20)).toBe('Fruit Flow')
    expect(getComboRating({ combo: 1, remainingRatio: 0, validSuccess: true })).toBe('Fresh')
    expect(getComboRating({ combo: 3, remainingRatio: 0.72, validSuccess: true })).toBe('Juicy')
    expect(getComboRating({ combo: 7, remainingRatio: 0.6, validSuccess: true })).toBe('Brilliant')
    expect(getComboRating({ combo: 10, remainingRatio: 0.1, validSuccess: true })).toBe('Fruit Flow')
  })

  it('uses the same simple harvest sound at every Combo level', () => {
    expect([5, 10, 15, 20].every(isComboMilestone)).toBe(true)
    const profiles = [1, 5, 10, 20].map((combo) => getComboSoundProfile(combo))
    expect(profiles).toEqual([profiles[0], profiles[0], profiles[0], profiles[0]])
    expect(profiles[0]).toMatchObject({ frequencies: [523.25, 659.25], offsets: [0, 0.045], duration: 0.16, waveform: 'sine', milestone: false })
  })

  it('reduces motion and low-stimulus feedback to the minimal tier', () => {
    expect(resolveEffectLevel(defaultSettings, false)).toBe('full')
    expect(resolveEffectLevel({ ...defaultSettings, animationIntensity: 'reduced' }, false)).toBe('reduced')
    expect(resolveEffectLevel({ ...defaultSettings, lowStimulus: true }, false)).toBe('minimal')
    expect(resolveEffectLevel(defaultSettings, true)).toBe('minimal')
    expect(getComboSoundProfile(20, true).frequencies).toEqual([523.25, 659.25])
  })
})
