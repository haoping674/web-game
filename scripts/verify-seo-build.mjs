import assert from 'node:assert/strict'
import { readFile, access } from 'node:fs/promises'
import { JSDOM } from 'jsdom'

const origin = 'https://games.haoping.tw'
const read = (path) => readFile(new URL(`../dist/${path}`, import.meta.url), 'utf8')
const sitemap = new JSDOM(await read('sitemap.xml'), { contentType: 'application/xml' }).window.document
const urls = [...sitemap.querySelectorAll('url > loc')].map((node) => node.textContent)
assert.equal(urls.length, 14, 'Sitemap must contain eight Chinese pages and six English pages')
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
  assert.equal(document.querySelectorAll(english ? '#root a[href^="/en/games/"]' : '#root a[href^="/games/"]').length, english ? 5 : 7, file)
  if (english) {
    assert.ok(!/[\u3400-\u9fff]/.test(document.querySelector('#root').textContent), file)
    const alternates = [...document.querySelectorAll('link[hreflang]')]
    assert.equal(alternates.length, 2, file)
    assert.ok(alternates.some(link => link.hreflang === 'en' && link.href === url), file)
    assert.ok(alternates.some(link => link.hreflang === 'zh-Hant'), file)
  }
  assert.ok(document.title && !titles.has(document.title), `Missing or duplicate title: ${file}`)
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
console.log('SEO build verified: 14 unique canonical pages, non-JS content, crawlable links, assets, sitemap and OpenAI robots rules.')
