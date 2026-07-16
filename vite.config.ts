import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

function deploymentBase(): string {
  const requestedBase = process.env.VITE_BASE_PATH ?? '/'
  const leadingSlash = requestedBase.startsWith('/') ? requestedBase : `/${requestedBase}`
  return leadingSlash.endsWith('/') ? leadingSlash : `${leadingSlash}/`
}

// Set VITE_BASE_PATH=/repository-name/ for a GitHub Pages project site.
export default defineConfig(() => {
  const base = deploymentBase()
  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: 'prompt',
        injectRegister: false,
        manifest: {
          name: 'Orchard Ten',
          short_name: 'Orchard Ten',
          description: 'A calm number puzzle: select neighboring fruit tiles that add up to ten.',
          start_url: base,
          scope: base,
          display: 'standalone',
          background_color: '#e8f0dc',
          theme_color: '#e8f0dc',
          lang: 'zh-Hant',
          orientation: 'any',
          categories: ['games', 'puzzle', 'entertainment'],
          icons: [
            { src: `${base}icons/orchard-ten.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
            { src: `${base}icons/orchard-ten-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: `${base}icons/orchard-ten-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: `${base}icons/orchard-ten-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          cleanupOutdatedCaches: true,
          navigateFallback: `${base}index.html`,
          navigateFallbackDenylist: [/^\/_/, /\/[^/?]+\.[^/]+$/],
          globPatterns: ['**/*.{html,js,css,svg,png,ico,webmanifest,woff2}'],
          // Precache only built, same-origin assets. No runtime rule means
          // external references are neither intercepted nor cached.
          runtimeCaching: [],
        },
        devOptions: { enabled: false },
      }),
    ],
  }
})
