import store from 'store2'
import type { StatusData } from './types'

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

// Half the window the server counts as active, so one dropped request does not
// take somebody out of the count.
const pingPeriod = 30000

export async function pingStatus() {
  try {
    await fetch(`/api/status/ping?id=${encodeURIComponent(visitorId())}`, {
      method: 'POST',
      // The last ping of a visit fires as the page is going away.
      keepalive: true
    })
  } catch {
    // Being counted is not worth an error in anybody's console.
  }
}

export function startStatusPings() {
  void pingStatus()

  const timer = setInterval(pingStatus, pingPeriod)

  return () => clearInterval(timer)
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

export function formatUptime(seconds: number) {
  if (seconds < 60) return `${Math.max(0, Math.floor(seconds))}s`

  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  // Two units is enough to read at a glance: a server up for days does not need
  // its minutes, and one up for minutes has no days to show.
  if (days) return `${days}d ${hours}h`
  if (hours) return `${hours}h ${minutes}m`

  return `${minutes}m`
}
