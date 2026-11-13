export type Locale = 'zh-Hant' | 'en'

export function localeFromPath(pathname: string): Locale {
  return pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'zh-Hant'
}

export function withoutLocale(pathname: string): string {
  return localeFromPath(pathname) === 'en' ? pathname.slice(3) || '/' : pathname
}

export function localizedPath(pathname: string, locale: Locale): string {
  const route = withoutLocale(pathname)
  return locale === 'en' ? `/en${route === '/' ? '' : route}` : route
}

export const ENGLISH_GAME_IDS = ['lengthSense', 'secondSense', 'fruitSum', 'colorLinks', 'slideTen'] as const

export const ENGLISH_GAMES = {
  lengthSense: { name: 'Length Sense', description: 'How good is your eye for length? Drag a line to match a target in CSS centimeters, then reveal your accuracy.' },
  secondSense: { name: 'Second Sense', description: 'Test your inner clock. Start the timer, then stop at exactly 1, 3 or 5 seconds without watching a countdown.' },
  fruitSum: { name: 'Orchard Ten', description: 'Drag a rectangle around numbered fruit that adds up to 10. Play this free number puzzle in your browser on desktop or mobile.' },
  colorLinks: { name: 'Color Links', description: 'Click empty cells to connect matching colors in four directions. Clear the board in 30 seconds in this free browser puzzle.' },
  slideTen: { name: 'Slide Ten', description: 'Slide numbered fruit into a line that adds up to 10. Clear space before the next wave arrives in this free number puzzle.' },
}
