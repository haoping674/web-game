export type GameId = 'fruitSum' | 'colorLinks' | 'sproutIsland' | 'ashbound'

export type GameDefinition = {
  id: GameId
  name: string
  eyebrow: string
  description: string
  route: `/games/${string}`
  status: 'available' | 'coming-soon'
  accent: string
}

export const GAME_REGISTRY = [
  {
    id: 'ashbound',
    name: '灰燼墓誌',
    eyebrow: 'ASHBOUND · DESCEND AGAIN',
    description: '選路、拾取遺物、安排每一回合。帶著餘火，挑戰十層暗黑地城。',
    route: '/games/ashbound',
    status: 'available',
    accent: '#52664f',
  },
  {
    id: 'sproutIsland',
    name: '芽芽小島',
    eyebrow: 'GROW A LITTLE · DREAM FOREVER',
    description: '點點陽光，合成精靈。把小小的島，養成無限可能。',
    route: '/games/sprout-island',
    status: 'available',
    accent: '#467b48',
  },
  {
    id: 'fruitSum',
    name: 'Orchard Ten',
    eyebrow: 'NUMBER HARVEST',
    description: '框選數字水果，讓總和剛好等於 10。',
    route: '/games/fruit-sum',
    status: 'available',
    accent: '#b44c3c',
  },
  {
    id: 'colorLinks',
    name: 'Color Links',
    eyebrow: 'COLOR SIGNAL',
    description: '30 秒內點擊空格，連結上下左右的相同色塊。',
    route: '/games/color-links',
    status: 'available',
    accent: '#327b77',
  },
] as const satisfies readonly GameDefinition[]

export function getGameDefinition(id: GameId): GameDefinition {
  const definition = GAME_REGISTRY.find((game) => game.id === id)
  if (!definition) throw new Error(`Unknown game: ${id}`)
  return definition
}
