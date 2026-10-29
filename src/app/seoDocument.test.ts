// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { updatePageMetadata } from './seoDocument'

afterEach(() => { document.head.innerHTML = '' })

describe('SEO metadata during client navigation', () => {
  it('updates game metadata and restores the home canonical when returning', () => {
    document.head.innerHTML = '<title>Orchard Arcade</title><link rel="canonical" href="https://games.haoping.tw/">' +
      ['name="description"', 'property="og:title"', 'property="og:description"', 'property="og:url"', 'name="twitter:title"', 'name="twitter:description"']
        .map((attribute) => `<meta ${attribute} content="initial">`).join('')
    updatePageMetadata('/games/fruit-sum')
    expect(document.title).toBe('Orchard Ten｜Orchard Arcade')
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://games.haoping.tw/games/fruit-sum')
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toContain('總和剛好等於 10')
    updatePageMetadata('/games/color-links')
    expect(document.title).toBe('Color Links｜Orchard Arcade')
    expect(document.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe('https://games.haoping.tw/games/color-links')
    updatePageMetadata('/')
    expect(document.title).toBe('Orchard Arcade｜免費線上遊戲')
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://games.haoping.tw/')
    expect(document.querySelector('meta[name="twitter:description"]')?.getAttribute('content')).toContain('七款')
  })
})
