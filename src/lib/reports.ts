import { visitorId } from './status'
import type { GameReport, GameVerdict, ReportKind, ReportsData } from './types'

// Talking to /api/reports. Reports are signed with the same random id the
// status counts use - it is what makes one report per person per game possible
// without anybody having an account.

export async function fetchReports(): Promise<ReportsData | null> {
  try {
    const response = await fetch(`/api/reports?id=${encodeURIComponent(visitorId())}`, { cache: 'no-store' })

    if (!response.ok) return null

    return (await response.json()) as ReportsData
  } catch {
    return null
  }
}

export async function fetchGameReport(game: string): Promise<GameReport | null> {
  try {
    const response = await fetch(`/api/reports/game?game=${encodeURIComponent(game)}&id=${encodeURIComponent(visitorId())}`, { cache: 'no-store' })

    if (!response.ok) return null

    return ((await response.json()) as { game: GameReport | null }).game
  } catch {
    return null
  }
}

// 'broken' with what they typed, 'works' to disagree, 'none' to take it back -
// the same request with a different word, so the caller never has to know
// there is more than one endpoint.
export async function sendReport(game: string, kind: ReportKind | 'none', note?: string): Promise<GameReport | null> {
  const params = new URLSearchParams({ game, id: visitorId(), kind })

  if (note) params.set('note', note)

  try {
    const response = await fetch(`/api/reports/report?${params}`, { method: 'POST' })

    if (!response.ok) return null

    return ((await response.json()) as { game: GameReport }).game
  } catch {
    return null
  }
}

// How much anybody can type into the box. The server has the real cap; this
// one is so the box stops taking characters it would drop.
export const noteLimit = 200

// How a verdict is said out loud. The short one goes on a badge over a game's
// artwork, so it has to fit; the long one is the sentence the reports page puts
// under it. A game nothing has been said about gets neither.
export const verdicts: Record<GameVerdict, { label: string; detail: string; tone: string; badge: string } | null> = {
  flagged: {
    label: 'Reported',
    detail: 'Somebody says this one is not working',
    tone: 'text-error',
    badge: 'badge-error'
  },
  working: {
    label: 'Working',
    detail: 'People are playing it, so any report against it is outweighed',
    tone: 'text-success',
    badge: 'badge-success'
  },
  unknown: null
}

// Visits are measured to the millisecond and read at a glance.
export function formatPlaytime(milliseconds: number | null) {
  if (milliseconds === null) return '—'

  const seconds = Math.round(milliseconds / 1000)

  if (seconds < 60) return `${seconds}s`

  const minutes = Math.floor(seconds / 60)

  if (minutes < 60) return `${minutes}m`

  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

export function formatWhen(at: number) {
  if (!at) return 'never'

  const ago = Date.now() - at
  const hours = Math.floor(ago / 3600000)

  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours}h ago`

  return `${Math.floor(hours / 24)}d ago`
}
