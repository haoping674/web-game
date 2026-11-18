import { localeFromPath, withoutLocale, ENGLISH_GAMES, ENGLISH_GAME_IDS, localizedPath, SITE_NAMES } from './locale.ts'
import { GAME_REGISTRY, type GameId } from './gameRegistry.ts'

export const SITE_ORIGIN = 'https://games.haoping.tw'
export const SITE_DESCRIPTION = '有空再來玩有七款手機也能玩的免費線上遊戲。估長度、猜秒數、玩數字和色彩益智，或養一座小島、闖進暗黑地城。打開就能玩，進度儲存於本機。'

const HOME_TITLES = { 'zh-Hant': '免費線上遊戲，手機也能玩', en: 'Free Browser Games' }

const CHINESE_GAME_SUBTITLES: Record<GameId, string> = {
  lengthSense: '目測長度挑戰',
  secondSense: '直覺計時挑戰',
  slideTen: '滑動數字湊十',
  ashbound: '回合制地城冒險',
  sproutIsland: '小島合成養成',
  fruitSum: '框選數字湊十',
  colorLinks: '限時色塊消除',
}

const ENGLISH_GAME_SUBTITLES: Record<keyof typeof ENGLISH_GAMES, string> = {
  lengthSense: 'Length Estimation Game',
  secondSense: 'Timing Challenge',
  fruitSum: 'Make 10 Number Puzzle',
  colorLinks: 'Timed Color Matching Puzzle',
  slideTen: 'Sliding Number Puzzle',
}

export function pageMetadata(pathname: string, base = '/') {
  const locale = localeFromPath(pathname)
  const isEnglish = locale === 'en'
  const game = GAME_REGISTRY.find((entry) => entry.route === withoutLocale(pathname))
  const englishGameId = ENGLISH_GAME_IDS.find(id => id === game?.id)
  const english = englishGameId ? ENGLISH_GAMES[englishGameId] : null
  const siteName = SITE_NAMES[locale]
  let titleParts = [HOME_TITLES[locale]]
  if (isEnglish && english && englishGameId) {
    titleParts = [english.name, ENGLISH_GAME_SUBTITLES[englishGameId]]
  } else if (!isEnglish && game) {
    titleParts = [game.name, CHINESE_GAME_SUBTITLES[game.id]]
  }
  const route = localizedPath(game?.route ?? '/', locale)
  const path = `${base.replace(/\/$/, '')}${route}`
  return {
    locale,
    siteName,
    title: [...titleParts, siteName].join(isEnglish ? ' | ' : '｜'),
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
