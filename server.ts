import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import http from 'node:http'
import type { Socket } from 'node:net'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
// The web stream on a fetch Response is typed by the DOM lib, which is not the
// type Readable.fromWeb wants.
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'
import { consola } from 'consola'
import express from 'express'
import { build } from 'vite'
import { startDiagnostics } from './src/server/diagnostics'
import { routeWisp } from './src/server/wisp'

startDiagnostics()

const httpServer = http.createServer()

const app = express()
const port = process.env.PORT || 3003

// The games CDN has moved hosts before, so let a deployment point /cdn
// somewhere else without a code change.
const cdnTarget = process.env.CDN_TARGET || 'https://gitlab.com/3kh0/3kh0-assets/-/raw/main'

// The upstream is rate limited per IP and every visitor's assets are fetched by
// this one server, so cache what comes back. Mount a volume on the directory to
// keep the cache across deploys.
const cacheDir = path.resolve(process.env.CDN_CACHE_DIR || '.cache/cdn')
const cacheEnabled = process.env.CDN_CACHE !== '0'

// Raw git hosts answer every text file as text/plain and attach their own CSP,
// so a game would arrive as source code the browser refuses to run.
const contentTypes: Record<string, string> = {
  '.css': 'text/css',
  '.htm': 'text/html',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.mjs': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.xml': 'application/xml'
}

// The image builds the frontend already, so a production container starts
// serving straight away instead of rebuilding on every restart.
if (process.env.NODE_ENV === 'production' && fs.existsSync(path.resolve('dist', 'index.html'))) {
  consola.info('Serving the prebuilt frontend in dist')
} else {
  consola.start('Building frontend')
  await build()
}

app.use(express.static('dist'))

// Refuse anything that would escape the cache directory, since the path comes
// from the request.
function cachePathFor(pathname: string) {
  const resolved = path.resolve(cacheDir, `.${path.posix.normalize(pathname)}`)

  return resolved.startsWith(`${cacheDir}${path.sep}`) ? resolved : null
}

async function cache(cachePath: string, body: NonNullable<Response['body']>) {
  const temporary = `${cachePath}.${randomUUID()}.part`

  await fsp.mkdir(path.dirname(cachePath), { recursive: true })

  try {
    // Write beside the target and rename, so a request that arrives mid-download
    // never reads half a file.
    await pipeline(Readable.fromWeb(body as NodeReadableStream), fs.createWriteStream(temporary))
    await fsp.rename(temporary, cachePath)
  } catch (error) {
    await fsp.rm(temporary, { force: true })
    throw error
  }
}

app.use('/cdn', async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.sendStatus(405)
    return
  }

  const { pathname, search } = new URL(req.url, 'http://localhost')
  const cachePath = cacheEnabled ? cachePathFor(pathname) : null

  if (cachePath && fs.existsSync(cachePath)) {
    res.sendFile(cachePath)
    return
  }

  try {
    const upstream = await fetch(`${cdnTarget}${pathname}${search}`)

    if (!upstream.ok || !upstream.body) {
      res.sendStatus(upstream.ok ? 502 : upstream.status)
      return
    }

    // Only the content type is worth keeping: raw git hosts also send a CSP and
    // an X-Frame-Options that would stop the game from running.
    const extension = path.extname(pathname).toLowerCase()
    res.type(contentTypes[extension] ?? upstream.headers.get('content-type') ?? 'application/octet-stream')

    if (!cachePath) {
      await pipeline(Readable.fromWeb(upstream.body as NodeReadableStream), res)
      return
    }

    await cache(cachePath, upstream.body)
    res.sendFile(cachePath)
  } catch (error) {
    consola.error(error)
    if (!res.headersSent) res.sendStatus(502)
  }
})

app.get('*', (_req, res) => {
  res.sendFile(path.resolve('dist', 'index.html'))
})

httpServer.on('request', (req, res) => {
  app(req, res)
})

httpServer.on('upgrade', (req, socket, head) => {
  if (req.url?.startsWith('/wisp/')) {
    routeWisp(req, socket as Socket, head)
  } else {
    socket.end()
  }
})

httpServer.on('listening', () => {
  consola.info(`Listening on http://localhost:${port}`)
})

httpServer.listen({
  port
})
