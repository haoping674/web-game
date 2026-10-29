import { pageMetadata } from './seo'

// Keep metadata correct after History API navigation as well as direct requests.
export function updatePageMetadata(pathname: string): void {
  const metadata = pageMetadata(pathname, import.meta.env.BASE_URL)
  document.title = metadata.title
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
