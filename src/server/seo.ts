import fs from 'node:fs'
import path from 'node:path'
import { defaultOrigin, isGameId, normalizePath, pages, seoForPath, tagsFor } from '../lib/seo'
import type { GameData } from '../lib/types'

// Google renders JavaScript, but it renders it later and not always, and every
// other crawler - the ones behind a link preview, a chat unfurl, a search
// engine that is not Google - reads the HTML it was handed and nothing else.
// The app is one index.html for every address, so without this they all read
// the same title and the same description, which is the same as having none.
// So the head is written into the file on the way out.

const origin = (process.env.SITE_ORIGIN || defaultOrigin).replace(/\/+$/, '')

// Where the served head begins and ends. index.html carries the same markers
// around its defaults, so a page's own tags replace them rather than joining
// them and leaving two of everything.
const openMarker = '<!--seo-->'
const closeMarker = '<!--/seo-->'

let template: string | null = null
let games: GameData[] | null = null

function escapeAttribute(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// A closing tag inside a script block would end the block early, whatever it is
// inside of as far as JSON is concerned.
function escapeJson(value: object) {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

function loadGames(): GameData[] {
  if (games) return games

  for (const file of [path.resolve('dist', 'games.json'), path.resolve('public', 'games.json')]) {
    try {
      games = JSON.parse(fs.readFileSync(file, 'utf8')) as GameData[]

      return games
    } catch {}
  }

  games = []

  return games
}

export function findGame(id: string) {
  if (!isGameId(id)) return null

  return loadGames().find((game) => game.id === id) ?? null
}

function head(pathname: string, game?: GameData) {
  const seo = seoForPath(pathname, { game, origin })

  const lines = [`<title>${escapeAttribute(seo.title)}</title>`]

  for (const meta of tagsFor(seo)) {
    lines.push(`<meta ${meta.key}="${escapeAttribute(meta.value)}" content="${escapeAttribute(meta.content)}" data-seo />`)
  }

  lines.push(`<link rel="canonical" href="${escapeAttribute(seo.canonical)}" data-seo />`)

  for (const data of seo.jsonLd) {
    lines.push(`<script type="application/ld+json" data-seo>${escapeJson(data)}</script>`)
  }

  // The title is the one tag the browser already has an element for, so it is
  // marked like the rest and the app replaces it along with them.
  return lines.map((line) => (line.startsWith('<title') ? line.replace('<title>', '<title data-seo>') : line)).join('\n    ')
}

// The address is either one of the app's own pages, a game that exists, or
// nothing. Answering nothing with a 200 is how a site ends up with thousands of
// indexed pages that are all the same empty screen.
export function resolve(pathname: string) {
  const normalized = normalizePath(pathname)

  if (normalized.startsWith('/route/')) return { status: 200, game: undefined }

  if (normalized.startsWith('/games/')) {
    const game = findGame(normalized.slice('/games/'.length))

    return { status: game ? 200 : 404, game: game ?? undefined }
  }

  return { status: pages[normalized] ? 200 : 404, game: undefined }
}

// The built index.html with this address's head in it. Read once: the file does
// not change under a running server, and every page load goes through here.
export function renderPage(pathname: string, file = path.resolve('dist', 'index.html')) {
  if (template === null) template = fs.readFileSync(file, 'utf8')

  return { status: resolve(pathname).status, html: inject(template, pathname) }
}

// Exported so the dev server can put the same head on the page vite serves,
// rather than the defaults, which is the only way to see what a crawler sees
// without deploying first.
export function inject(html: string, pathname: string) {
  const rendered = head(pathname, resolve(pathname).game)
  const start = html.indexOf(openMarker)
  const end = html.indexOf(closeMarker)

  if (start !== -1 && end > start) {
    return `${html.slice(0, start + openMarker.length)}\n    ${rendered}\n    ${html.slice(end)}`
  }

  // No markers, so somebody edited them out of index.html. Adding the head is
  // still better than serving none, even if the defaults are left in place
  // beside it.
  return html.replace('</head>', `${rendered}\n  </head>`)
}
