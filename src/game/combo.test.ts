import { describe, expect, it } from 'vitest'
import { getComboWindowMs } from './comboConfig'
import { resolveEffectLevel } from './comboEffects'
import { getNextGameWakeDelay } from './comboTimer'
import { getComboTier, getComboTitle, isComboMilestone } from './comboTier'
import { defaultSettings } from './storage'
import { getComboSoundProfile } from './soundManager'

describe('mode Combo configuration', () => {
  it.each([
    ['classic', [8_000, 7_200, 6_400, 5_600]],
    ['quick', [6_800, 6_200, 5_600, 5_000]],
    ['hard', [7_200, 6_400, 5_800, 5_200]],
  ] as const)('uses the four configured windows for %s', (mode, expected) => {
    expect([1, 3, 6, 10].map((combo) => getComboWindowMs(mode, combo))).toEqual(expected)
  })

  it('does not retain another mode window after switching modes', () => {
    expect(getComboWindowMs('classic', 7)).toBe(6_400)
    expect(getComboWindowMs('quick', 7)).toBe(5_600)
    expect(getComboWindowMs('hard', 7)).toBe(5_800)
  })

  it('wakes exactly for either the round tick or Combo expiry', () => {
    expect(getNextGameWakeDelay(2_000, 1_500, 1_000)).toBe(501)
    expect(getNextGameWakeDelay(1_200, 1_500, 1_000)).toBe(200)
    expect(getNextGameWakeDelay(null, null, 1_000)).toBeNull()
  })
})

describe('Combo feedback tiers', () => {
  it('maps every boundary to the correct tier and title', () => {
    expect([0, 2, 3, 5, 6, 9, 10].map(getComboTier)).toEqual(['base', 'base', 'rising', 'rising', 'charged', 'charged', 'legendary'])
    expect(getComboTitle(9)).toBeNull()
    expect(getComboTitle(10)).toBe('十果流星')
    expect(getComboTitle(20)).toBe('果園星潮')
  })

  it('uses special layered sounds only at 5, 10 and 20, with a capped high-tier cycle', () => {
    expect([5, 10, 20].every(isComboMilestone)).toBe(true)
    expect(getComboSoundProfile(10).milestone).toBe(true)
    expect(getComboSoundProfile(11).frequencies).toHaveLength(3)
    expect(getComboSoundProfile(15).frequencies).toEqual(getComboSoundProfile(11).frequencies)
    expect(getComboSoundProfile(20).frequencies).not.toHaveLength(0)
  })

  it('reduces motion and low-stimulus feedback to the minimal tier', () => {
    expect(resolveEffectLevel(defaultSettings, false)).toBe('full')
    expect(resolveEffectLevel({ ...defaultSettings, animationIntensity: 'reduced' }, false)).toBe('reduced')
    expect(resolveEffectLevel({ ...defaultSettings, lowStimulus: true }, false)).toBe('minimal')
    expect(resolveEffectLevel(defaultSettings, true)).toBe('minimal')
    expect(getComboSoundProfile(20, true).frequencies).toHaveLength(2)
  })
})
