import assert from 'node:assert/strict'
import { readFile, access } from 'node:fs/promises'
import { JSDOM } from 'jsdom'

const origin = 'https://games.haoping.tw'
const read = (path) => readFile(new URL(`../dist/${path}`, import.meta.url), 'utf8')
const sitemap = new JSDOM(await read('sitemap.xml'), { contentType: 'application/xml' }).window.document
const urls = [...sitemap.querySelectorAll('url > loc')].map((node) => node.textContent)
assert.equal(urls.length, 8, 'Sitemap must contain the home page and seven games')
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
  assert.equal(document.querySelectorAll('#root a[href^="/games/"]').length, 7, file)
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
assert.deepEqual(config.rewrites, [{ source: '/games/:game', destination: '/games/:game.html' }])
console.log('SEO build verified: 8 unique canonical pages, non-JS content, crawlable links, assets, sitemap and OpenAI robots rules.')
