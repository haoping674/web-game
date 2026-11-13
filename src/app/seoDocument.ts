import { pageMetadata, languageAlternates } from './seo'

// Keep metadata correct after History API navigation as well as direct requests.
export function updatePageMetadata(pathname: string): void {
  const metadata = pageMetadata(pathname, import.meta.env.BASE_URL)
  document.documentElement.lang = metadata.locale
  document.title = metadata.title
  document.querySelector('meta[property="og:locale"]')?.setAttribute('content', metadata.locale === 'en' ? 'en_US' : 'zh_TW')
  document.querySelectorAll('link[hreflang]').forEach(link => link.remove())
  for (const alternate of languageAlternates(pathname, import.meta.env.BASE_URL)) {
    const link = document.createElement('link')
    link.rel = 'alternate'
    link.hreflang = alternate.locale
    link.href = alternate.url
    document.head.append(link)
  }
  for (const [selector, content] of [
    ['meta[name="description"]', metadata.description],
    ['meta[property="og:title"]', metadata.title],
    ['meta[property="og:description"]', metadata.description],
    ['meta[property="og:url"]', metadata.url],
    ['meta[name="twitter:title"]', metadata.title],
    ['meta[name="twitter:description"]', metadata.description],
  ]) {
    document.querySelector(selector)?.setAttribute('content', content)
  }
  document.querySelector('link[rel="canonical"]')?.setAttribute('href', metadata.url)
}
