import { localeFromPath, withoutLocale, ENGLISH_GAMES, ENGLISH_GAME_IDS, localizedPath } from './locale.ts'
import { GAME_REGISTRY } from './gameRegistry.ts'

export const SITE_ORIGIN = 'https://games.haoping.tw'
export const SITE_TITLE = 'Orchard Arcade｜免費線上遊戲'
export const SITE_DESCRIPTION = 'Orchard Arcade 提供七款手機也能玩的免費線上遊戲：長感挑戰、秒感挑戰、滑滑湊十、灰燼墓誌、芽芽小島、Orchard Ten 與 Color Links。打開就能玩，進度儲存於本機。'

const ENGLISH_TITLES = {
  lengthSense: 'Length Sense – Test Your Eye for Length',
  secondSense: 'Second Sense – Test Your Inner Clock',
  fruitSum: 'Orchard Ten – Free Make 10 Number Puzzle',
  colorLinks: 'Color Links – Free Color Matching Puzzle',
  slideTen: 'Slide Ten – Free Sliding Number Puzzle',
}

export function pageMetadata(pathname: string, base = '/') {
  const game = GAME_REGISTRY.find((entry) => entry.route === withoutLocale(pathname))
  const locale = localeFromPath(pathname)
  const english = game && Object.hasOwn(ENGLISH_GAMES, game.id) ? ENGLISH_GAMES[game.id as keyof typeof ENGLISH_GAMES] : null
  const route = localizedPath(game?.route ?? '/', locale)
  const path = `${base.replace(/\/$/, '')}${route}`
  return {
    locale,
    title: locale === 'en' ? (game && english ? `${ENGLISH_TITLES[game.id as keyof typeof ENGLISH_TITLES]} | Orchard Arcade` : 'Free Browser Games – Orchard Arcade') : game ? `${game.name}｜Orchard Arcade` : SITE_TITLE,
    description: locale === 'en' ? english?.description ?? 'Play five free browser games on your phone or desktop. Test your timing and visual estimation, or try number and color puzzles. No download needed.' : game?.description ?? SITE_DESCRIPTION,
    url: `${SITE_ORIGIN}${path}`,
    game,
  }
}


export function languageAlternates(pathname: string, base = '/') {
  const route = withoutLocale(pathname)
  if (route !== '/' && !GAME_REGISTRY.some(game => game.route === route && ENGLISH_GAME_IDS.some(id => id === game.id))) return []
  return (['zh-Hant', 'en'] as const).map(locale => ({ locale, url: SITE_ORIGIN + base.replace(/\/$/, '') + localizedPath(route, locale) }))
}
