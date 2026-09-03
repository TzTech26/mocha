import { visitorId } from './status'
import type { GameReport, GameVerdict, ReportKind, ReportsData } from './types'

// Talking to /api/reports, and the one place the words on the buttons are
// written down. Reports are signed with the same random id the status counts
// use - it is what makes one report per person per game possible without
// anybody having an account.

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

// 'none' takes a report back, which is the same request with a different word,
// so the caller never has to know there are two endpoints.
export async function sendReport(game: string, kind: ReportKind | 'none'): Promise<GameReport | null> {
  try {
    const response = await fetch(`/api/reports/report?game=${encodeURIComponent(game)}&id=${encodeURIComponent(visitorId())}&kind=${kind}`, { method: 'POST' })

    if (!response.ok) return null

    return ((await response.json()) as { game: GameReport }).game
  } catch {
    return null
  }
}

// How a verdict is said out loud. The short one goes on a badge over a game's
// artwork, so it has to fit; the long one is the sentence the reports page
// puts under it.
export const verdicts: Record<GameVerdict, { label: string; detail: string; tone: string; badge: string } | null> = {
  broken: {
    label: 'Not working',
    detail: 'Enough people reported this that nothing else outweighs them',
    tone: 'text-error',
    badge: 'badge-error'
  },
  keyboard: {
    label: 'Keyboard',
    detail: 'It loads, and what people report is that the keys do nothing',
    tone: 'text-warning',
    badge: 'badge-warning'
  },
  suspect: {
    label: 'Walked out of',
    detail: 'Nobody reported it, but almost everybody leaves within the minute',
    tone: 'text-warning',
    badge: 'badge-warning'
  },
  reported: {
    label: 'Reported',
    detail: 'Somebody says it is broken and there is not yet enough either way',
    tone: 'text-info',
    badge: 'badge-info'
  },
  working: {
    label: 'Working',
    detail: 'People are playing it, so any report against it is outweighed',
    tone: 'text-success',
    badge: 'badge-success'
  },
  // Nothing to say is not a state worth putting on a card.
  unknown: null
}

// What the report dialog offers, in the order it offers it. 'works' is
// deliberately in the same list: the fastest way to clear a game somebody
// flagged by mistake is for the next person to disagree.
export const reportKinds: { kind: ReportKind; label: string; detail: string }[] = [
  { kind: 'broken', label: "It doesn't load", detail: 'A black screen, an error, or it never finishes loading' },
  { kind: 'keyboard', label: 'The keyboard does nothing', detail: 'It loads and the mouse works, but no key does anything' },
  { kind: 'other', label: 'Something else is wrong', detail: 'It loads but it is not playable' },
  { kind: 'works', label: 'It works for me', detail: 'Say so, and a report against it counts for less' }
]

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
