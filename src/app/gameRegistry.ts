export type GameId = 'fruitSum' | 'colorLinks'

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
    description: '點擊空格，連結上下左右的相同色塊。',
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
