import assert from 'node:assert/strict'
import { readFile, access } from 'node:fs/promises'
import { JSDOM } from 'jsdom'

const origin = 'https://games.haoping.tw'
const read = (path) => readFile(new URL(`../dist/${path}`, import.meta.url), 'utf8')
const sitemap = new JSDOM(await read('sitemap.xml'), { contentType: 'application/xml' }).window.document
const urls = [...sitemap.querySelectorAll('url > loc')].map((node) => node.textContent)
assert.equal(urls.length, 16, 'Sitemap must contain ten Chinese pages and six English pages')
assert.ok(urls.includes(`${origin}/games/tissue-roll`), 'Tissue Roll must have a Chinese index entry')
assert.ok(urls.includes(`${origin}/games/cola-shake`), 'Cola Shake must have a Chinese index entry')
assert.equal(new Set(urls).size, urls.length, 'Sitemap URLs must be unique')
const titles = new Set()
for (const url of urls) {
  assert.equal(new URL(url).origin, origin)
  const pathname = new URL(url).pathname
  const file = pathname === '/' ? 'index.html' : `${pathname.slice(1)}.html`
  const document = new JSDOM(await read(file)).window.document
  assert.equal(document.querySelector('link[rel="canonical"]')?.href, url, file)
  assert.equal(document.querySelector('meta[property="og:url"]')?.content, url, file)
  assert.equal(document.querySelector('meta[name="robots"]')?.content, 'index, follow', file)
  assert.ok(document.querySelector('meta[name="description"]')?.content, file)
  assert.ok(document.querySelector('#root h1')?.textContent, `Missing non-JS content: ${file}`)
  const english = pathname === '/en' || pathname.startsWith('/en/')
  assert.equal(document.documentElement.lang, english ? 'en' : 'zh-Hant', file)
  assert.equal(document.querySelectorAll(english ? '#root a[href^="/en/games/"]' : '#root a[href^="/games/"]').length, english ? 5 : 9, file)
  if (english) {
    assert.ok(!/[\u3400-\u9fff]/.test(document.querySelector('#root').textContent), file)
    const alternates = [...document.querySelectorAll('link[hreflang]')]
    assert.equal(alternates.length, 2, file)
    assert.ok(alternates.some(link => link.hreflang === 'en' && link.href === url), file)
    assert.ok(alternates.some(link => link.hreflang === 'zh-Hant'), file)
  }
  assert.ok(document.title && !titles.has(document.title), `Missing or duplicate title: ${file}`)
  const siteName = english ? 'Got a Minute?' : '有空再來玩'
  const titleParts = document.title.split(english ? ' | ' : '｜')
  const heading = document.querySelector('#root h1').textContent
  assert.equal(titleParts.at(-1), siteName, file)
  assert.equal(document.querySelector('meta[property="og:site_name"]')?.content, siteName, file)
  assert.equal(document.querySelector('meta[property="og:title"]')?.content, document.title, file)
  assert.equal(document.querySelector('meta[name="twitter:title"]')?.content, document.title, file)
  if (pathname === '/' || pathname === '/en') {
    assert.equal(heading, english ? siteName : '免費網頁小遊戲，挑一款就開玩', file)
    assert.deepEqual(titleParts, [english ? 'Free Browser Games' : '免費網頁小遊戲，免下載直接玩', siteName], file)
    if (!english) {
      assert.ok(document.querySelector('meta[name="description"]').content.includes('免費網頁小遊戲'), file)
    }
  } else {
    assert.equal(titleParts.length, 3, file)
    assert.equal(titleParts[0], heading, file)
    assert.ok(titleParts[1].trim(), `Missing gameplay descriptor: ${file}`)
  }
  const websiteData = document.querySelector('script[type="application/ld+json"]')
  if (pathname === '/') {
    assert.deepEqual(JSON.parse(websiteData?.textContent ?? 'null'), {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      url,
      name: '有空再來玩',
      alternateName: 'Got a Minute?',
    })
  } else {
    assert.equal(websiteData, null, file)
  }
  titles.add(document.title)
  const script = document.querySelector('script[type="module"][src]')
  assert.ok(script, `React entry point missing: ${file}`)
  await access(new URL(`../dist${script.getAttribute('src')}`, import.meta.url))
}
const robots = await read('robots.txt')
for (const agent of ['*', 'OAI-SearchBot', 'ChatGPT-User']) {
  assert.ok(robots.includes(`User-agent: ${agent}\nAllow: /`), agent)
}
assert.ok(robots.includes(`Sitemap: ${origin}/sitemap.xml`))
assert.ok(!/Disallow:\s*\//i.test(robots))
const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'))
assert.deepEqual(config.rewrites, [{ source: '/en', destination: '/en.html' }, { source: '/en/games/:game', destination: '/en/games/:game.html' }, { source: '/games/:game', destination: '/games/:game.html' }])
console.log(`SEO build verified: ${urls.length} unique titles and canonicals, site names, non-JS content, crawlable links, assets, sitemap and robots rules.`)
