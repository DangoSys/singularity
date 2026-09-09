import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { extname, join, normalize, resolve, sep } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import { MAP_PATH } from '../../constants.ts'

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.json': 'application/json; charset=utf-8',
}

const require = createRequire(import.meta.url)

function appDir(): string {
  const pkg = require.resolve('@dangosys/dsh-singularity-map/package.json')
  return resolve(pkg, '..', 'dist')
}

function assetPath(root: string, rel: string): string {
  const abs = resolve(root, normalize(rel))
  if (abs !== root && !abs.startsWith(root + sep)) throw new Error(`map static: path escape "${rel}"`)
  return abs
}

export function registerMapStatic(ctx: Context): () => void {
  const root = appDir()
  const prefix = MAP_PATH

  const serve = async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', 'http://dsh.local')
    let rel = url.pathname.slice(prefix.length).replace(/^\/+/, '') || 'index.html'
    if (rel.endsWith('/')) rel += 'index.html'
    const abs = assetPath(root, rel)
    const body = await readFile(abs)
    const type = MIME[extname(abs).toLowerCase()]
    if (type === undefined) throw new Error(`map static: unknown mime for ${abs}`)
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' })
    res.end(body)
  }

  const stopRedirect = ctx.webServer.register({
    kind: 'exact',
    path: prefix,
    handler: (_req, res) => {
      res.writeHead(302, { location: prefix + '/' })
      res.end()
    },
  })
  const stopStatic = ctx.webServer.register({
    kind: 'prefix',
    path: prefix,
    handler: serve,
  })
  return () => {
    stopRedirect()
    stopStatic()
  }
}
