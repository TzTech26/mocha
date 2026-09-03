import type { transports } from './transport'

export interface TabData {
  name: string | null
  icon: string | null
}

export interface PanicData {
  key: string | null
  url: string | null
}

export interface AboutBlankData {
  enabled: boolean
}

export interface TransportData {
  transport: keyof typeof transports
}

export interface ThemeData {
  theme: string | null
}

export interface SearchEngineData {
  engine: 'google' | 'duckduckgo' | 'ecosia'
}

export interface GameData {
  name: string
  id: string
  file: string
  image: string
}

export interface BrowsingData {
  localStorage?: {
    key: string
    value: string
  }[]
  cookies?: {
    [key: string]: unknown
  }[]
}

export interface ShortcutData {
  name: string
  url: string
  image: string
}

export interface Bookmark {
  image: string
  title: string
  url: string
}

export interface TopGame {
  id: string
  plays: number
  players: number
  repeats: number
  today: number
  playing: number
}

export interface HistoryHour {
  hour: number
  peak: number
  plays: number
}

export interface StatusData {
  now: {
    active: number
    watching: number
    playing: number
    proxying: number
  }
  people: {
    total: number
    returning: number
    newToday: number
    activeToday: number
    activeWeek: number
    peak: number
    peakAt: number
  }
  games: {
    plays: number
    playsDay: number
    players: number
    tracked: number
    top: TopGame[]
  }
  uptime: {
    current: number
    longest: number
    since: number
    restarts: number
    up: number
    down: number
    percent: number | null
  }
  history: HistoryHour[]
  startedAt: number
}

// What one person can say about one game, and 'none' for taking it back.
export type ReportKind = 'broken' | 'works'

// How the server reads the reports on a game together with how long people
// stay in it. See src/server/reports.ts for what separates them.
export type GameVerdict = 'flagged' | 'working' | 'unknown'

export interface ReportNote {
  text: string
  at: number
}

export interface GameReport {
  id: string
  verdict: GameVerdict
  flags: number
  works: number
  support: number
  visits: number
  long: number
  typical: number | null
  notes: ReportNote[]
  lastReport: number
  last: number
  you: ReportKind | null
}

export interface ReportsData {
  games: GameReport[]
  counts: {
    flagged: number
    working: number
    unknown: number
    tracked: number
    disputed: number
    reports: number
    confirmations: number
  }
  rules: {
    disputeRatio: number
    provenWeight: number
    provenSeconds: number
    voteDays: number
    maxNote: number
  }
}

export interface DebugData {
  enabled: boolean
}

export interface DevtoolsData {
  enabled: boolean
}

export interface ContentWindow extends Window {
  __uv$location: Location
  // biome-ignore lint: we don't know dude
  eruda: any
}

export interface Patch {
  hostname: string
  works?: boolean
  execute?: (contentWindow: ContentWindow) => void // for injecting scripts into websites (not sure what it could be used for yet)
  suggestedTransport?: keyof typeof transports
  // Offers a different address for the same site when one of them survives the
  // proxy better. Not shown once the suggested host is the one already loaded.
  suggestedUrl?: {
    url: string
    reason: string
  }
}

declare global {
  interface Window {
    // biome-ignore lint: we don't know dude
    eruda?: any
  }
}
