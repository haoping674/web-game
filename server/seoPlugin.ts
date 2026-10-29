import type { Plugin } from 'vite'
import { GAME_REGISTRY } from '../src/app/gameRegistry.ts'
import { pageMetadata, SITE_ORIGIN } from '../src/app/seo.ts'

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
}

export function seoPlugin(): Plugin {
  let base = '/'
  function renderPage(template: string, pathname: string): string {
    const { title, description, url, game } = pageMetadata(pathname, base)
    const href = (route: string) => escapeHtml(`${base.replace(/\/$/, '')}${route}`)
    // Public content is served to every user agent; React replaces it on mount.
    const content = `<main><h1>${escapeHtml(game?.name ?? 'Orchard Arcade')}</h1><p>${escapeHtml(description)}</p>${game ? `<p>這款遊戲需要啟用 JavaScript。遊戲進度儲存在本機。</p><a href="${href('/')}">返回遊戲廳</a>` : ''}<nav aria-label="遊戲列表"><ul>${GAME_REGISTRY.map((entry) => `<li><a href="${href(entry.route)}">${escapeHtml(entry.name)}</a><p>${escapeHtml(entry.description)}</p></li>`).join('')}</ul></nav></main>`
    return template
      .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`)
      .replace(/<meta name="description" content="[^"]*"\s*\/>/, `<meta name="description" content="${escapeHtml(description)}" />`)
      .replace(/<meta property="og:title" content="[^"]*"\s*\/>/, `<meta property="og:title" content="${escapeHtml(title)}" />`)
      .replace(/<meta property="og:description" content="[^"]*"\s*\/>/, `<meta property="og:description" content="${escapeHtml(description)}" />`)
      .replace('</head>', `<link rel="canonical" href="${escapeHtml(url)}" /><meta name="robots" content="index, follow" /><meta property="og:type" content="website" /><meta property="og:site_name" content="Orchard Arcade" /><meta property="og:locale" content="zh_TW" /><meta property="og:url" content="${escapeHtml(url)}" /><meta name="twitter:card" content="summary" /><meta name="twitter:title" content="${escapeHtml(title)}" /><meta name="twitter:description" content="${escapeHtml(description)}" /></head>`)
      .replace('<div id="root"></div>', `<div id="root">${content}</div>`)
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
      for (const game of GAME_REGISTRY) {
        this.emitFile({ type: 'asset', fileName: `${game.route.slice(1)}.html`, source: renderPage(template, game.route) })
      }
      const sitemapUrl = `${SITE_ORIGIN}${base}sitemap.xml`
      const rules = ['User-agent: *', 'Allow: /', '', 'User-agent: OAI-SearchBot', 'Allow: /', '', 'User-agent: ChatGPT-User', 'Allow: /', '', `Sitemap: ${sitemapUrl}`, ''].join('\n')
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: rules })
      const urls = ['/', ...GAME_REGISTRY.map((game) => game.route)].map((route) => `<url><loc>${escapeHtml(pageMetadata(route, base).url)}</loc></url>`).join('')
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n` })
    },
  }
}
