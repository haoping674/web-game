import { FRUIT_THEMES } from './constants'
import type { ComboTier } from './comboTier'

export type FruitTheme = (typeof FRUIT_THEMES)[number]
export type ParticleShape = 'circle' | 'seed' | 'leaf' | 'peel' | 'spark' | 'droplet'

export type FruitParticlePreset = {
  colors: readonly string[]
  shapes: readonly ParticleShape[]
  particleCount: number
  speedRange: readonly [number, number]
  sizeRange: readonly [number, number]
  lifetimeRange: readonly [number, number]
  gravity: number
  drag: number
  rotationSpeed: number
  spread: number
}

export type FruitParticleOrigin = {
  id: string
  type: FruitTheme
  centerX: number
  centerY: number
  width: number
  height: number
}

export type FruitRemovedEvent = {
  fruits: readonly FruitParticleOrigin[]
  combo: number
  tier: ComboTier
  milestone: boolean
}

export type ParticleInstance = {
  x: number
  y: number
  velocityX: number
  velocityY: number
  size: number
  lifetime: number
  age: number
  gravity: number
  drag: number
  rotation: number
  rotationSpeed: number
  color: string
  shape: ParticleShape
}

export type ParticleIntensity = 'full' | 'reduced' | 'minimal' | 'off'

export const PARTICLE_BUDGET = {
  maxPerClear: 30,
  maxActive: 48,
  maxPerFruit: 6,
  maxLifetimeMs: 720,
} as const

/** Themes mirror the visual classes already assigned by FruitCell. */
export const fruitParticlePresets = {
  berry: { colors: ['#dc5263', '#ff96a5', '#7aa754'], shapes: ['circle', 'seed', 'leaf'], particleCount: 5, speedRange: [84, 140], sizeRange: [3, 6], lifetimeRange: [300, 460], gravity: 310, drag: 0.986, rotationSpeed: 5.2, spread: Math.PI * 2 },
  citrus: { colors: ['#f39a32', '#ffd15a', '#ffb26b'], shapes: ['droplet', 'circle', 'peel'], particleCount: 5, speedRange: [98, 158], sizeRange: [3, 7], lifetimeRange: [290, 430], gravity: 270, drag: 0.985, rotationSpeed: 4.3, spread: Math.PI * 2 },
  leaf: { colors: ['#4e9d67', '#93c96c', '#e7dc75'], shapes: ['leaf', 'circle', 'seed'], particleCount: 4, speedRange: [74, 126], sizeRange: [3, 7], lifetimeRange: [330, 520], gravity: 250, drag: 0.987, rotationSpeed: 6.1, spread: Math.PI * 1.7 },
  plum: { colors: ['#6e4c9b', '#9b6bb5', '#e3a4c3'], shapes: ['circle', 'circle', 'spark'], particleCount: 6, speedRange: [82, 138], sizeRange: [2, 5], lifetimeRange: [310, 450], gravity: 290, drag: 0.986, rotationSpeed: 4.4, spread: Math.PI * 2 },
  melon: { colors: ['#ef6659', '#4f9f71', '#3e4141'], shapes: ['droplet', 'peel', 'seed'], particleCount: 5, speedRange: [82, 152], sizeRange: [3, 8], lifetimeRange: [350, 540], gravity: 350, drag: 0.985, rotationSpeed: 6.7, spread: Math.PI * 2 },
  peach: { colors: ['#ef8e78', '#ffc5a2', '#73a260'], shapes: ['droplet', 'circle', 'leaf'], particleCount: 5, speedRange: [78, 132], sizeRange: [3, 7], lifetimeRange: [290, 450], gravity: 300, drag: 0.986, rotationSpeed: 4.8, spread: Math.PI * 2 },
  apple: { colors: ['#d9514f', '#8e2836', '#ffe29a'], shapes: ['circle', 'peel', 'leaf'], particleCount: 5, speedRange: [78, 132], sizeRange: [3, 7], lifetimeRange: [320, 500], gravity: 335, drag: 0.986, rotationSpeed: 5.5, spread: Math.PI * 2 },
  mint: { colors: ['#62b89d', '#b6e0a3', '#f5f2a4'], shapes: ['leaf', 'spark', 'circle'], particleCount: 4, speedRange: [72, 122], sizeRange: [3, 6], lifetimeRange: [300, 460], gravity: 240, drag: 0.987, rotationSpeed: 5.9, spread: Math.PI * 1.75 },
  sun: { colors: ['#f6c84d', '#fff0a7', '#f58b42'], shapes: ['spark', 'circle', 'droplet'], particleCount: 5, speedRange: [94, 152], sizeRange: [3, 6], lifetimeRange: [270, 420], gravity: 260, drag: 0.985, rotationSpeed: 4.2, spread: Math.PI * 2 },
} as const satisfies Record<FruitTheme, FruitParticlePreset>

export function getFruitTheme(index: number): FruitTheme {
  return FRUIT_THEMES[index % FRUIT_THEMES.length]!
}

function fraction(seed: number): number {
  return (Math.sin(seed * 12.9898) * 43758.5453) % 1 + ((Math.sin(seed * 12.9898) * 43758.5453) < 0 ? 1 : 0)
}

function idSeed(id: string): number {
  return Array.from(id).reduce((value, character) => ((value * 31) + character.charCodeAt(0)) >>> 0, 17)
}

function interpolate([minimum, maximum]: readonly [number, number], amount: number): number {
  return minimum + (maximum - minimum) * amount
}

function particlesPerFruit(event: FruitRemovedEvent, intensity: ParticleIntensity, deviceScale: number): number {
  if (intensity === 'off' || event.fruits.length === 0) return 0
  if (intensity === 'minimal') return 1
  const baseBudget = intensity === 'reduced' ? 16 : 24
  const available = Math.max(1, Math.floor((baseBudget * deviceScale) / event.fruits.length))
  return Math.min(PARTICLE_BUDGET.maxPerFruit, available)
}

/** Pure, deterministic factory: no DOM, timers, or random global state. */
export function createFruitParticles(event: FruitRemovedEvent, intensity: ParticleIntensity, deviceScale = 1): ParticleInstance[] {
  const each = particlesPerFruit(event, intensity, deviceScale)
  if (each === 0) return []
  const normalizedCombo = Math.min(20, Math.max(0, event.combo))
  const speedBoost = normalizedCombo >= 10 ? 1.16 : normalizedCombo >= 6 ? 1.1 : normalizedCombo >= 3 ? 1.05 : 1
  const particles: ParticleInstance[] = []

  for (const fruit of event.fruits) {
    const preset = fruitParticlePresets[fruit.type]
    const count = Math.min(each, preset.particleCount, PARTICLE_BUDGET.maxPerFruit)
    const seed = idSeed(fruit.id)
    for (let index = 0; index < count && particles.length < PARTICLE_BUDGET.maxPerClear; index += 1) {
      const randomA = fraction(seed + index * 5 + normalizedCombo)
      const randomB = fraction(seed + index * 7 + 19)
      const randomC = fraction(seed + index * 11 + 37)
      const shape = intensity === 'minimal'
        ? 'circle'
        : preset.shapes[index % preset.shapes.length]!
      const angle = ((index / Math.max(1, count)) - 0.5) * preset.spread + randomA * 0.42 - 0.21 - Math.PI / 2
      const speed = interpolate(preset.speedRange, randomB) * speedBoost
      particles.push({
        x: fruit.centerX + (randomA - 0.5) * fruit.width * 0.16,
        y: fruit.centerY + (randomB - 0.5) * fruit.height * 0.16,
        velocityX: Math.cos(angle) * speed,
        velocityY: Math.sin(angle) * speed - (shape === 'seed' ? 18 : 0),
        size: interpolate(preset.sizeRange, randomC) * (intensity === 'reduced' ? 0.86 : 1),
        lifetime: Math.min(PARTICLE_BUDGET.maxLifetimeMs, interpolate(preset.lifetimeRange, randomA)),
        age: 0,
        gravity: preset.gravity,
        drag: preset.drag,
        rotation: randomC * Math.PI,
        rotationSpeed: (randomA > 0.5 ? 1 : -1) * preset.rotationSpeed,
        color: preset.colors[index % preset.colors.length]!,
        shape,
      })
    }
  }

  if (intensity === 'full' && normalizedCombo >= 10 && particles.length < PARTICLE_BUDGET.maxPerClear) {
    const source = event.fruits[0]
    if (source) particles.push({ x: source.centerX, y: source.centerY, velocityX: 0, velocityY: -90, size: 3.5, lifetime: 270, age: 0, gravity: 50, drag: 0.99, rotation: 0, rotationSpeed: 0, color: '#fff3a3', shape: 'spark' })
  }
  return particles
}
