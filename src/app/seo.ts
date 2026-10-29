import { GAME_REGISTRY } from './gameRegistry.ts'

export const SITE_ORIGIN = 'https://games.haoping.tw'
export const SITE_TITLE = 'Orchard Arcade｜免費線上遊戲'
export const SITE_DESCRIPTION = 'Orchard Arcade 提供七款手機也能玩的免費線上遊戲：長感挑戰、秒感挑戰、滑滑湊十、灰燼墓誌、芽芽小島、Orchard Ten 與 Color Links。打開就能玩，進度儲存於本機。'

export function pageMetadata(pathname: string, base = '/') {
  const game = GAME_REGISTRY.find((entry) => entry.route === pathname)
  const path = `${base.replace(/\/$/, '')}${game?.route ?? '/'}`
  return {
    title: game ? `${game.name}｜Orchard Arcade` : SITE_TITLE,
    description: game?.description ?? SITE_DESCRIPTION,
    url: `${SITE_ORIGIN}${path}`,
    game,
  }
}

