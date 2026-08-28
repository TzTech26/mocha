import fs from 'node:fs'
import http from 'node:http'
import type { Socket } from 'node:net'
import path from 'node:path'
import { consola } from 'consola'
import express from 'express'
import httpProxy from 'http-proxy'
import { build } from 'vite'
import wisp from 'wisp-server-node'

const httpServer = http.createServer()
const proxy = httpProxy.createProxyServer()

const app = express()
const port = process.env.PORT || 3003

// The games CDN has moved hosts before, so let a deployment point /cdn
// somewhere else without a code change.
const cdnTarget = process.env.CDN_TARGET || 'https://gitlab.com/3kh0/3kh0-assets/-/raw/main'

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

// A failed upstream request emits on the proxy itself, and an unhandled error
// event takes the whole server down with it.
proxy.on('error', (error, _req, res) => {
  consola.error(error)

  if ('writeHead' in res) {
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'text/plain' })
    res.end('Bad gateway')
  } else {
    res.destroy()
  }
})

proxy.on('proxyRes', (proxyRes, req) => {
  for (const header of ['content-security-policy', 'content-security-policy-report-only', 'x-frame-options', 'content-disposition']) {
    delete proxyRes.headers[header]
  }

  const extension = path.extname(new URL(req.url ?? '/', 'http://localhost').pathname).toLowerCase()
  const contentType = contentTypes[extension]

  if (contentType && proxyRes.headers['content-type']?.startsWith('text/plain')) {
    proxyRes.headers['content-type'] = `${contentType}; charset=utf-8`
  }
})

app.use('/cdn', (req, res) => {
  proxy.web(req, res, {
    target: cdnTarget,
    changeOrigin: true,
    // @ts-ignore
    rewritePath: {
      '^/cdn': ''
    }
  })
})

app.get('*', (_req, res) => {
  res.sendFile(path.resolve('dist', 'index.html'))
})

httpServer.on('request', (req, res) => {
  app(req, res)
})

httpServer.on('upgrade', (req, socket, head) => {
  if (req.url?.startsWith('/wisp/')) {
    wisp.routeRequest(req, socket as Socket, head)
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
