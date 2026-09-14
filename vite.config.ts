import { execSync } from 'node:child_process'
import { defineConfig, normalizePath } from 'vite'
import solid from 'vite-plugin-solid'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { handleReportsRequest } from './src/server/reports'
import { inject } from './src/server/seo'
import { buildSitemap } from './src/server/sitemap'
import { handleStatusRequest } from './src/server/status'
import { routeWisp } from './src/server/wisp'

import path from 'node:path'
import { baremuxPath } from '@mercuryworkshop/bare-mux/node'
// @ts-expect-error
import { epoxyPath } from '@mercuryworkshop/epoxy-transport'
import { libcurlPath } from '@mercuryworkshop/libcurl-transport'
import { uvPath } from '@titaniumnetwork-dev/ultraviolet'

// Deploy targets (Coolify, Docker builds) copy the source without the .git directory,
// so fall back to whatever commit SHA the platform exposes before shelling out to git.
const gitCommit = () => {
  const fromEnv = process.env.SOURCE_COMMIT ?? process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.CF_PAGES_COMMIT_SHA
  if (fromEnv) return fromEnv

  try {
    return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return 'unknown'
  }
}

const cdnTarget = process.env.CDN_TARGET || 'https://assets.3kh0.net'

export default defineConfig({
  plugins: [
    solid(),
    {
      // Express serves this in production. Without it here the status page is
      // blank in development, which reads as a broken page rather than a
      // missing dev server route.
      name: 'Status API',
      configureServer(server) {
        server.middlewares.use('/api/status', handleStatusRequest)
        server.middlewares.use('/api/reports', handleReportsRequest)
      }
    },
    {
      // Express writes the head of each page in production. In development
      // vite serves index.html itself, so the same head is written here,
      // otherwise every page in development says what the home page says and
      // there is no way to look at what a crawler would be handed.
      name: 'Page Heads',
      apply: 'serve',
      transformIndexHtml: {
        order: 'pre',
        handler(html, ctx) {
          return inject(html, (ctx.originalUrl ?? '/').split('?')[0])
        }
      }
    },
    {
      // Built from the route table rather than checked in, and served in
      // development too so the address in robots.txt answers in both.
      name: 'Sitemap',
      configureServer(server) {
        server.middlewares.use('/sitemap.xml', (_req, res) => {
          res.setHeader('content-type', 'application/xml')
          res.end(buildSitemap())
        })
      },
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'sitemap.xml',
          source: buildSitemap()
        })
      }
    },
    {
      name: 'Wisp Server',
      configureServer(server) {
        server.httpServer?.on('upgrade', (req, socket, head) => {
          if (req.url?.startsWith('/wisp/')) {
            routeWisp(req, socket, head)
          }
        })
      }
    },
    viteStaticCopy({
      targets: [
        {
          src: [normalizePath(path.resolve(uvPath, 'uv.bundle.js')), normalizePath(path.resolve(uvPath, 'uv.handler.js')), normalizePath(path.resolve(uvPath, 'uv.client.js')), normalizePath(path.resolve(uvPath, 'uv.sw.js'))],
          dest: 'coffee'
        },
        {
          src: normalizePath(path.resolve(baremuxPath, 'worker.js')),
          dest: 'bare-mux'
        },
        {
          src: normalizePath(path.resolve(epoxyPath, 'index.mjs')),
          dest: 'epoxy'
        },
        {
          src: normalizePath(path.resolve(libcurlPath, 'index.mjs')),
          dest: 'libcurl'
        }
      ]
    })
  ],
  server: {
    proxy: {
      // For development purposes
      '/cdn': {
        target: cdnTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/cdn/, '')
      }
    }
  },
  define: {
    __BUILD_DATE__: Date.now(),
    __GIT_COMMIT__: JSON.stringify(gitCommit()),
    __PRODUCTION__: process.env.NODE_ENV === 'production'
  }
})
