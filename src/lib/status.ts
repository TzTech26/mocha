import store from 'store2'
import type { StatusData, TopGame } from './types'

// The server counts people, not tabs, so it needs something that tells two
// browsers apart and survives a reload. This is a random id the browser makes
// up for itself and keeps in local storage - no name, no account, nothing tied
// to it, and clearing browser data hands out a new one.
const idPattern = /^[a-zA-Z0-9-]{8,64}$/

function newId() {
  // randomUUID needs a secure context, which a Mocha deployment on plain HTTP
  // is not, so fall back to something of the same shape.
  if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID()

  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function visitorId() {
  const saved = store('visitor') as unknown

  if (typeof saved === 'string' && idPattern.test(saved)) return saved

  const id = newId()
  store('visitor', id)

  return id
}

// One per page load and never stored, so two windows are two tabs of one
// person. Without it a second window would overwrite the first and somebody
// with the status page open beside a game would look like they were only
// watching.
const tabId = newId()

type PageKind = 'site' | 'proxy' | 'game' | 'status'

// The router knows where it is going before the address bar does: an effect on
// the route runs while window.location still holds the page being left, so the
// path is handed in rather than read back. Without this every ping reports the
// page somebody just left, and opening the status page never takes them out of
// the count.
let currentPath = window.location.pathname

// The proxy viewer's route is the base64 of what it is showing, and a game is
// something under /cdn, so the page can tell the server what it is doing
// without anything having to be plumbed through to here.
function pageContext(pathname: string): { kind: PageKind; game?: string } {
  if (pathname === '/status') return { kind: 'status' }

  if (pathname.startsWith('/route/')) {
    try {
      const target = atob(decodeURIComponent(pathname.slice('/route/'.length)))
      const game = /^\/cdn\/([a-zA-Z0-9._-]+)\//.exec(target)

      if (game) return { kind: 'game', game: game[1] }
    } catch {
      // A route that is not valid base64 is not a game either.
    }

    return { kind: 'proxy' }
  }

  return { kind: 'site' }
}

// Half the window the server counts as active, so one dropped request does not
// take somebody out of the count.
const pingPeriod = 30000

export async function pingStatus(path?: string) {
  if (path) currentPath = path

  const { kind, game } = pageContext(currentPath)
  const params = new URLSearchParams({ id: visitorId(), tab: tabId, kind })

  if (game) params.set('game', game)

  try {
    await fetch(`/api/status/ping?${params}`, {
      method: 'POST',
      // The last ping of a visit fires as the page is going away.
      keepalive: true
    })
  } catch {
    // Being counted is not worth an error in anybody's console.
  }
}

// The layout pings on every route change, so this is only the clock that keeps
// somebody sitting still on one page in the count.
export function startStatusPings() {
  const timer = setInterval(pingStatus, pingPeriod)

  return () => clearInterval(timer)
}

export async function recordPlay(game: string) {
  try {
    await fetch(`/api/status/play?id=${encodeURIComponent(visitorId())}&game=${encodeURIComponent(game)}`, {
      method: 'POST',
      keepalive: true
    })
  } catch {
    // The game still opens.
  }
}

export async function fetchStatus(): Promise<StatusData | null> {
  try {
    const response = await fetch('/api/status', { cache: 'no-store' })

    if (!response.ok) return null

    return (await response.json()) as StatusData
  } catch {
    return null
  }
}

export async function fetchTopGames(limit: number): Promise<TopGame[]> {
  try {
    const response = await fetch(`/api/status/games?limit=${limit}`, { cache: 'no-store' })

    if (!response.ok) return []

    return ((await response.json()) as { top: TopGame[] }).top ?? []
  } catch {
    return []
  }
}

export function formatDuration(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000))

  if (seconds < 60) return `${seconds}s`

  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  // Two units is enough to read at a glance: a server up for days does not need
  // its minutes, and one up for minutes has no days to show.
  if (days) return `${days}d ${hours}h`
  if (hours) return `${hours}h ${minutes}m`

  return `${minutes}m`
}

export function formatPercent(percent: number | null) {
  if (percent === null) return '—'

  // Three decimals is how uptime is quoted everywhere else, and rounding 99.94
  // up to 100 would claim a record nobody has.
  const rounded = Math.floor(percent * 1000) / 1000

  return `${rounded >= 99.999 ? '100' : rounded.toFixed(rounded >= 99 ? 3 : 1)}%`
}
