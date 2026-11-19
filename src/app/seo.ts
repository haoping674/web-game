import { localeFromPath, withoutLocale, ENGLISH_GAMES, ENGLISH_GAME_IDS, localizedPath, SITE_NAMES } from './locale.ts'
import { GAME_REGISTRY, type GameId } from './gameRegistry.ts'

export const SITE_ORIGIN = 'https://games.haoping.tw'
export const CHINESE_HOME_HEADING = ['免費網頁小遊戲，', '挑一款就開玩'] as const
export const CHINESE_HOME_INTRO = ['估長度、猜秒數、湊十、養小島或闖地城。', '手機和電腦打開瀏覽器就能玩。'] as const
export const SITE_DESCRIPTION = `${SITE_NAMES['zh-Hant']}收錄 ${GAME_REGISTRY.length} 款免下載的免費網頁小遊戲。${CHINESE_HOME_INTRO.join('')}`

const HOME_TITLES = { 'zh-Hant': '免費網頁小遊戲，免下載直接玩', en: 'Free Browser Games' }

const CHINESE_GAME_SUBTITLES: Record<GameId, string> = {
  tissueRoll: '擬真 3D 盒裝面紙',
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
