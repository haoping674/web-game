import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { leaderboardRequest } from './leaderboard.ts'

async function middleware(req: IncomingMessage, res: ServerResponse, next: () => void) {
  if (req.url?.split('?')[0] !== '/api/leaderboard') { next(); return }
  try {
    const chunks: Buffer[] = []
    let length = 0
    for await (const chunk of req) {
      length += Buffer.byteLength(chunk)
      if (length > 2048) { res.writeHead(413, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: '資料過長。' })); return }
      chunks.push(Buffer.from(chunk))
    }
    const method = req.method ?? 'GET'
    const headers = new Headers()
    for (const [key, value] of Object.entries(req.headers)) if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value)
    const request = new Request(`http://${req.headers.host ?? 'localhost'}${req.url}`, {
      method, headers, ...(method !== 'GET' && method !== 'HEAD' ? { body: Buffer.concat(chunks).toString() } : {}),
    })
    const response = await leaderboardRequest(request)
    res.writeHead(response.status, Object.fromEntries(response.headers))
    res.end(await response.text())
  } catch { res.writeHead(500); res.end() }
}

export function leaderboardPlugin(): Plugin {
  return {
    name: 'arcade-leaderboard-api',
    configureServer(server) { server.middlewares.use((req, res, next) => { void middleware(req, res, next) }) },
    configurePreviewServer(server) { server.middlewares.use((req, res, next) => { void middleware(req, res, next) }) },
  }
}
