import { ENGLISH_GUIDES } from '../src/app/englishGuides.ts'
import { ENGLISH_GAME_IDS, ENGLISH_GAMES, localizedPath, SITE_NAMES } from '../src/app/locale.ts'
import { GAME_GUIDES } from '../src/app/gameGuides.ts'
import type { Plugin } from 'vite'
import { GAME_REGISTRY } from '../src/app/gameRegistry.ts'
import { CHINESE_HOME_HEADING, pageMetadata, SITE_ORIGIN, languageAlternates } from '../src/app/seo.ts'

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
}

// Inline so the initial screen does not depend on the app's CSS or JS download.
const bootStyles = `<style>
body:has(.boot-screen){margin:0;background:#e8f0dc;color:#27322f;font-family:system-ui,sans-serif}
.boot-screen{display:none;min-height:100vh;min-height:100dvh;box-sizing:border-box;padding:24px;place-content:center;justify-items:center;gap:16px;text-align:center}
.app-booting .boot-screen{display:grid}
.app-booting .boot-content{display:none}
.boot-screen span{display:grid;place-items:center;width:54px;height:54px;border:2px solid #27322f;border-radius:50%;background:#fffdf6;color:#b44c3c;font-size:24px;box-shadow:4px 4px 0 #27322f;animation:boot-turn 1.2s ease-in-out infinite}
@keyframes boot-turn{0%,100%{transform:rotate(-12deg)}50%{transform:rotate(78deg)}}
@media(prefers-reduced-motion:reduce){.boot-screen span{animation:none}}
.boot-screen p{margin:0;color:#68746c;font-size:14px}
.boot-content{box-sizing:border-box;width:min(760px,calc(100% - 32px));margin:32px auto;padding:clamp(20px,4vw,40px);border:2px solid #27322f;border-radius:18px;background:#fffdf6;line-height:1.8;overflow-wrap:anywhere}
.boot-content h1{font:700 clamp(28px,5vw,48px)/1.2 system-ui,sans-serif;letter-spacing:-.03em}
.boot-content a{color:#84362c}
.boot-content a:focus-visible{outline:3px solid #216546;outline-offset:3px}
</style>`

// Restore the readable page if the module fails to start.
const bootScript = `<script>document.documentElement.classList.add('app-booting');setTimeout(function(){document.documentElement.classList.remove('app-booting')},12000)</script>`

export function seoPlugin(): Plugin {
  let base = '/'
  function renderPage(template: string, pathname: string): string {
    const { title, description, url, game, locale, siteName } = pageMetadata(pathname, base)
    const href = (route: string) => escapeHtml(`${base.replace(/\/$/, '')}${route}`)
    // Public content is served to every user agent; React replaces it on mount.
    const english = locale === 'en'
    const games = GAME_REGISTRY.filter(entry => !english || ENGLISH_GAME_IDS.some(id => id === entry.id))
    const name = game ? (english ? ENGLISH_GAMES[game.id as keyof typeof ENGLISH_GAMES].name : game.name) : english ? siteName : CHINESE_HOME_HEADING.join('')
    const guide = game ? (english ? ENGLISH_GUIDES[game.id as keyof typeof ENGLISH_GUIDES] : GAME_GUIDES[game.id]) : null
    const headings = english ? ['Controls', 'Rules', 'Scoring and records', 'Try this'] : ['操作方式', '遊戲規則', '計分與紀錄', '試試這個方法']
    const guideHtml = guide ? `<section aria-label="${english ? 'Play guide' : '遊玩指南'}"><h2>${escapeHtml(name)}${english ? ' play guide' : '遊玩指南'}</h2><p>${escapeHtml(guide.goal)}</p>${[[headings[0]!, guide.controls], [headings[1]!, guide.rules], [headings[2]!, guide.scoring], [headings[3]!, guide.tip]].map(([heading, text]) => `<h3>${escapeHtml(heading)}</h3><p>${escapeHtml(text)}</p>`).join('')}</section>` : ''
    const content = `<main><h1>${escapeHtml(name)}</h1><p>${escapeHtml(description)}</p>${game ? `<p>${english ? 'Enable JavaScript to play. Progress is saved on this device.' : '這款遊戲需要啟用 JavaScript。遊戲進度儲存在本機。'}</p><a href="${href(localizedPath('/', locale))}">${english ? 'Back to games' : '返回遊戲廳'}</a>` : ''}${guideHtml}<nav aria-label="${english ? 'Games' : '遊戲列表'}"><ul>${games.map((entry) => `<li><a href="${href(localizedPath(entry.route, locale))}">${escapeHtml(english ? ENGLISH_GAMES[entry.id as keyof typeof ENGLISH_GAMES].name : entry.name)}</a><p>${escapeHtml(english ? ENGLISH_GAMES[entry.id as keyof typeof ENGLISH_GAMES].description : entry.description)}</p></li>`).join('')}</ul></nav></main>`
    const alternates = languageAlternates(pathname, base).map(entry => `<link rel="alternate" hreflang="${entry.locale}" href="${escapeHtml(entry.url)}" />`).join('')
    const websiteData = pathname === '/' ? `<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      url,
      name: SITE_NAMES['zh-Hant'],
      alternateName: SITE_NAMES.en,
    }).replace(/</g, '\\u003c')}</script>` : ''
    return template
      .replace('<html lang="zh-Hant">', `<html lang="${locale}">`)
      .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`)
      .replace(/<meta name="description" content="[^"]*"\s*\/>/, `<meta name="description" content="${escapeHtml(description)}" />`)
      .replace(/<meta property="og:title" content="[^"]*"\s*\/>/, `<meta property="og:title" content="${escapeHtml(title)}" />`)
      .replace(/<meta property="og:description" content="[^"]*"\s*\/>/, `<meta property="og:description" content="${escapeHtml(description)}" />`)
      .replace(/<meta property="og:site_name" content="[^"]*"\s*\/>/, `<meta property="og:site_name" content="${escapeHtml(siteName)}" />`)
      .replace('</head>', `${websiteData}${alternates}<link rel="canonical" href="${escapeHtml(url)}" /><meta name="robots" content="index, follow" /><meta property="og:type" content="website" /><meta property="og:locale" content="${english ? 'en_US' : 'zh_TW'}" /><meta property="og:url" content="${escapeHtml(url)}" /><meta name="twitter:card" content="summary" /><meta name="twitter:title" content="${escapeHtml(title)}" /><meta name="twitter:description" content="${escapeHtml(description)}" /></head>`)
      .replace('</head>', `${bootStyles}${bootScript}</head>`)
      .replace('<div id="root"></div>', `<div id="root"><div class="boot-screen" role="status" aria-live="polite"><span aria-hidden="true">✦</span><p>${english ? 'Preparing the arcade…' : '正在準備遊戲廳…'}</p></div><div class="boot-content">${content}</div></div>`)
  }

  return {
    name: 'public-seo-pages',
    enforce: 'post',
    configResolved(config) { base = config.base },
    generateBundle(_options, bundle) {
      const index = bundle['index.html']
      if (!index || index.type !== 'asset' || typeof index.source !== 'string') {
        throw new Error('SEO pages require the built index.html asset')
      }
      const template = index.source
      index.source = renderPage(template, '/')
      const englishRoutes = ['/en', ...GAME_REGISTRY.filter(game => ENGLISH_GAME_IDS.some(id => id === game.id)).map(game => '/en' + game.route)]
      for (const route of englishRoutes) {
        this.emitFile({ type: 'asset', fileName: route.slice(1) + '.html', source: renderPage(template, route) })
      }
      for (const game of GAME_REGISTRY) {
        this.emitFile({ type: 'asset', fileName: `${game.route.slice(1)}.html`, source: renderPage(template, game.route) })
      }
      const sitemapUrl = `${SITE_ORIGIN}${base}sitemap.xml`
      const rules = ['User-agent: *', 'Allow: /', '', 'User-agent: OAI-SearchBot', 'Allow: /', '', 'User-agent: ChatGPT-User', 'Allow: /', '', `Sitemap: ${sitemapUrl}`, ''].join('\n')
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: rules })
      const urls = ['/', ...GAME_REGISTRY.map((game) => game.route), ...englishRoutes].map((route) => `<url><loc>${escapeHtml(pageMetadata(route, base).url)}</loc></url>`).join('')
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n` })
    },
  }
}
