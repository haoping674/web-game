import { useCallback, useEffect, useState } from 'react'

export const HOME_ROUTE = '/'

function deploymentBasePath(): string {
  const base = import.meta.env.BASE_URL
  if (base === '/') return ''
  return base.endsWith('/') ? base.slice(0, -1) : base
}

export function readAppPathname(): string {
  const base = deploymentBasePath()
  const pathname = window.location.pathname
  if (base && pathname.startsWith(base)) {
    const relative = pathname.slice(base.length)
    return relative.startsWith('/') ? relative : `/${relative}`
  }
  return pathname || HOME_ROUTE
}

export function toAppUrl(route: string): string {
  const base = deploymentBasePath()
  return `${base}${route === '/' ? '/' : route}`
}

export function navigate(route: string, options: { replace?: boolean } = {}): void {
  const url = toAppUrl(route)
  const method = options.replace ? 'replaceState' : 'pushState'
  window.history[method](null, '', url)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function useAppPathname(): [string, (route: string) => void] {
  const [pathname, setPathname] = useState(readAppPathname)
  useEffect(() => {
    const update = () => setPathname(readAppPathname())
    window.addEventListener('popstate', update)
    return () => window.removeEventListener('popstate', update)
  }, [])
  const go = useCallback((route: string) => navigate(route), [])
  return [pathname, go]
}
