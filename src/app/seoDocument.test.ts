// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { updatePageMetadata } from './seoDocument'

afterEach(() => { document.head.innerHTML = '' })

describe('SEO metadata during client navigation', () => {
  it('updates game metadata and restores the home canonical when returning', () => {
    document.head.innerHTML = '<title></title><link rel="canonical" href="https://games.haoping.tw/">' +
      ['name="description"', 'property="og:title"', 'property="og:description"', 'property="og:url"', 'name="twitter:title"', 'name="twitter:description"']
        .map((attribute) => `<meta ${attribute} content="initial">`).join('')
    updatePageMetadata('/games/fruit-sum')
    expect(document.title).toBe('Orchard Ten｜框選數字湊十｜有空再來玩')
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://games.haoping.tw/games/fruit-sum')
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toContain('總和剛好等於 10')
    updatePageMetadata('/games/color-links')
    expect(document.title).toBe('Color Links｜限時色塊消除｜有空再來玩')
    expect(document.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe('https://games.haoping.tw/games/color-links')
    updatePageMetadata('/')
    expect(document.title).toBe('免費網頁小遊戲，免下載直接玩｜有空再來玩')
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://games.haoping.tw/')
    expect(document.querySelector('meta[name="twitter:description"]')?.getAttribute('content')).toContain('9 款')
  })
})

it('keeps language alternates reciprocal and English canonicals independent', () => {
  document.head.innerHTML = '<title></title><link rel="canonical"><meta property="og:locale"><meta property="og:site_name">'
  updatePageMetadata('/en/games/second-sense')
  expect(document.documentElement.lang).toBe('en')
  expect(document.title).toBe('Second Sense | Timing Challenge | Got a Minute?')
  expect(document.querySelector('meta[property="og:site_name"]')?.getAttribute('content')).toBe('Got a Minute?')
  expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://games.haoping.tw/en/games/second-sense')
  expect([...document.querySelectorAll('link[hreflang]')].map(link => link.getAttribute('href'))).toEqual([
    'https://games.haoping.tw/games/second-sense',
    'https://games.haoping.tw/en/games/second-sense',
  ])
  updatePageMetadata('/games/second-sense')
  expect(document.documentElement.lang).toBe('zh-Hant')
  expect(document.querySelector('meta[property="og:site_name"]')?.getAttribute('content')).toBe('有空再來玩')
  expect(document.querySelectorAll('link[hreflang]')).toHaveLength(2)
  updatePageMetadata('/games/ashbound')
  expect(document.querySelectorAll('link[hreflang]')).toHaveLength(0)
})
