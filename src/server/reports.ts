// Which games are working, and how anybody would know.
//
// A game here is a folder on somebody else's CDN, loaded through a proxy, into
// an iframe. There are a few hundred of them and no way to test one from the
// server: fetching index.html says the file is there, not that the game runs,
// keeps its keyboard, or is playable at all. The only instrument Mocha has is
// the people playing, so this counts two things they say.
//
// The first is a report. Anyone can flag a game as broken from the viewer or
// from the reports page, and anyone can say the same game works for them. One
// report is a report, not a verdict: a game somebody flagged that everybody
// else is playing fine is a disagreement, and the page says so rather than
// hiding the game. It takes agreement to call a game broken, and enough
// disagreement to clear it again.
//
// The second is nobody's opinion at all. The status ping already says which
// game each tab is on, so how long people stay is measurable, and it is the
// honest signal: a game that holds somebody for five minutes ran. A game that
// everybody walks out of inside a minute, over and over, is worth flagging
// before anyone has said a word about it - which is the case a report system
// on its own always misses, because the people it happens to leave.
//
// Reports outlive the process, so they are written beside the status counts
// with the same discipline: a temporary file and a rename, so a read landing
// mid-write never sees half of it.
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import { consola } from 'consola'

const dataFile = path.resolve(process.env.REPORTS_DATA_FILE || '.cache/reports.json')
const persistEnabled = process.env.REPORTS_PERSIST !== '0'

// Wait after a change before writing, so a game that several people flag at
// once is one write rather than one per person.
const saveDelay = Number(process.env.REPORTS_SAVE_SECONDS ?? 60) * 1000

// Reports are made by whoever is calling, so the same ceilings the status
// counts have: a script inventing ids should cost memory it cannot grow.
const maxGames = Number(process.env.REPORTS_MAX_GAMES ?? 2000)
const maxVoters = Number(process.env.REPORTS_MAX_VOTERS_PER_GAME ?? 500)
const maxSessions = Number(process.env.REPORTS_MAX_SESSIONS ?? 50000)

// A report is about a game as it was that week. Games are hosted somewhere
// else and get fixed without anybody telling us, so a report stops counting
// after this and a game nobody has complained about lately goes back to being
// unreported rather than staying flagged forever.
const voteDays = Number(process.env.REPORTS_VOTE_DAYS ?? 30)

// A visit shorter than this is somebody leaving, and one longer than the
// second is a game that demonstrably ran. Between the two is the ordinary
// case that says nothing either way.
const bounceWindow = Number(process.env.REPORTS_BOUNCE_SECONDS ?? 60) * 1000
const provenWindow = Number(process.env.REPORTS_PROVEN_SECONDS ?? 300) * 1000

// Browsers ping every 30 seconds, so a tab silent for this long has gone and
// its visit can be measured. Kept in step with STATUS_ACTIVE_SECONDS.
const sessionWindow = Number(process.env.REPORTS_SESSION_SECONDS ?? 90) * 1000

// How many people have to independently report a game before it is called
// broken rather than reported.
const confirmFlags = Number(process.env.REPORTS_CONFIRM_FLAGS ?? 2)

// How much heavier the evidence for a game has to be than the reports against
// it before a report is treated as answered. Two people saying it works
// against one saying it does not is the case this exists for.
const disputeRatio = Number(process.env.REPORTS_DISPUTE_RATIO ?? 2)

// Long visits are evidence, but they are old evidence: a game that broke this
// morning still has every long visit it ever held. So they can outweigh a
// report or two and never a crowd of them.
const provenWeight = Number(process.env.REPORTS_PROVEN_WEIGHT ?? 3)

// Before this many measured visits, everybody walking out means nothing.
const autoSessions = Number(process.env.REPORTS_AUTO_SESSIONS ?? 8)
const autoBounceRate = Number(process.env.REPORTS_AUTO_BOUNCE ?? 0.9)

// How many games the reports page is handed. Everything flagged comes first,
// so the cap only ever drops games nobody has said anything about.
const maxListed = Number(process.env.REPORTS_MAX_LISTED ?? 250)

const day = 86400000

// Ids and game names come off a query string, so they are only ever stored
// after they look like the ones we hand out and the ones in games.json.
const idPattern = /^[a-zA-Z0-9-]{8,64}$/
const gamePattern = /^[a-zA-Z0-9._-]{1,64}$/

// What somebody can say about a game. 'works' is the other half of the
// system: without a way to disagree, one person could flag anything.
export type Kind = 'broken' | 'keyboard' | 'other' | 'works'

const kinds: Kind[] = ['broken', 'keyboard', 'other', 'works']

// broken   - enough people agree, and nothing outweighs them
// keyboard - the same, and what they agree on is that the keys do nothing
// suspect  - nobody has said anything, but everybody leaves immediately
// reported - somebody flagged it and there is not yet enough either way
// working  - reports are outweighed, or there were never any and it holds people
// unknown  - too little of anything to say
export type Verdict = 'broken' | 'keyboard' | 'suspect' | 'reported' | 'working' | 'unknown'

interface Vote {
  kind: Kind
  at: number
}

interface GameRecord {
  votes: Map<string, Vote>
  // Measured visits, in whole numbers rather than a list of them: what the
  // verdict asks is how many ran long and how many were walked out of.
  visits: number
  short: number
  long: number
  time: number
  last: number
}

interface Session {
  visitor: string
  game: string
  first: number
  last: number
}

const records = new Map<string, GameRecord>()

// Keyed by tab, because one person with the game open twice is two visits and
// a person moving between two games is two more.
const sessions = new Map<string, Session>()

let saveTimer: NodeJS.Timeout | null = null

function recordFor(game: string) {
  const existing = records.get(game)

  if (existing) return existing

  if (records.size >= maxGames) return null

  const created: GameRecord = { votes: new Map(), visits: 0, short: 0, long: 0, time: 0, last: 0 }
  records.set(game, created)

  return created
}

function serialize() {
  return JSON.stringify({
    version: 1,
    games: [...records].map(([id, entry]) => [id, entry.visits, entry.short, entry.long, entry.time, entry.last, [...entry.votes].map(([visitor, vote]) => [visitor, vote.kind, vote.at])])
  })
}

async function save() {
  if (!persistEnabled) return

  const temporary = `${dataFile}.${randomUUID()}.part`

  try {
    await fsp.mkdir(path.dirname(dataFile), { recursive: true })
    await fsp.writeFile(temporary, serialize())
    await fsp.rename(temporary, dataFile)
  } catch (error) {
    await fsp.rm(temporary, { force: true })
    consola.warn(`reports: could not write ${dataFile} - ${error}`)
  }
}

function saveSync() {
  if (!persistEnabled) return

  try {
    fs.mkdirSync(path.dirname(dataFile), { recursive: true })
    fs.writeFileSync(dataFile, serialize())
  } catch (error) {
    consola.warn(`reports: could not write ${dataFile} - ${error}`)
  }
}

function scheduleSave() {
  if (!persistEnabled || saveTimer) return

  saveTimer = setTimeout(() => {
    saveTimer = null
    void save()
  }, saveDelay)

  saveTimer.unref()
}

function load() {
  if (!persistEnabled) return

  try {
    const saved = JSON.parse(fs.readFileSync(dataFile, 'utf8'))

    for (const [id, visits, short, long, time, last, votes] of saved?.games ?? []) {
      if (typeof id !== 'string' || !gamePattern.test(id)) continue

      const entry: GameRecord = {
        votes: new Map(),
        visits: Number(visits) || 0,
        short: Number(short) || 0,
        long: Number(long) || 0,
        time: Number(time) || 0,
        last: Number(last) || 0
      }

      for (const [visitor, kind, at] of votes ?? []) {
        if (typeof visitor !== 'string' || !idPattern.test(visitor)) continue
        if (!kinds.includes(kind)) continue

        entry.votes.set(visitor, { kind, at: Number(at) || 0 })
      }

      records.set(id, entry)
    }
  } catch (error) {
    // A missing file is the normal first start.
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      consola.warn(`reports: could not read ${dataFile}, starting with no reports - ${error}`)
    }
  }
}

// A visit that has ended, which is the only kind worth measuring: how long
// somebody stayed is not a number until they have gone.
//
// How it ended is what says when. A tab that pings from somewhere else has just
// left, so that ping is the end of the visit; a tab that stopped pinging could
// have gone at any point in the window since, so the last ping we did get is
// all we know. Both round downwards, which is the safe direction: a visit
// counted short at worst leaves a working game unproven.
function closeSession(session: Session, at: number, left: boolean) {
  const entry = recordFor(session.game)

  if (!entry) return

  const held = Math.max(0, (left ? at : session.last) - session.first)

  entry.visits++
  entry.time += held
  entry.last = Math.max(entry.last, session.last || at)

  if (held < bounceWindow) entry.short++
  if (held >= provenWindow) entry.long++

  scheduleSave()
}

// Called by the status ping for every tab, with the game it is on or nothing
// when it is not on one. Everything the automatic half of this knows comes
// through here.
export function notePresence(tab: string, visitor: string, game: string | undefined, at: number) {
  const open = sessions.get(tab)

  if (open) {
    // Left the game, moved to another one, or was gone long enough that
    // whatever comes next is a new visit rather than the same one.
    if (!game || open.game !== game || at - open.last > sessionWindow) {
      sessions.delete(tab)
      // A ping that says where they are now is a goodbye; one that arrives
      // after a long silence is the tab having been away the whole time.
      closeSession(open, at, at - open.last <= sessionWindow)
    } else {
      open.last = at
      return
    }
  }

  if (!game || !gamePattern.test(game)) return
  if (sessions.size >= maxSessions) return

  sessions.set(tab, { visitor, game, first: at, last: at })
}

// Tabs stop pinging without saying goodbye, which is what closing the tab
// looks like from here, so visits are also ended on a clock.
function sweep() {
  const at = Date.now()

  for (const [tab, session] of sessions) {
    if (at - session.last > sessionWindow) {
      sessions.delete(tab)
      closeSession(session, at, false)
    }
  }
}

function fresh(vote: Vote, at: number) {
  return at - vote.at <= voteDays * day
}

interface Counts {
  broken: number
  keyboard: number
  other: number
  works: number
  lastReport: number
}

function count(entry: GameRecord, at: number): Counts {
  const counts: Counts = { broken: 0, keyboard: 0, other: 0, works: 0, lastReport: 0 }

  for (const [visitor, vote] of entry.votes) {
    // Counting is also when expired reports are forgotten, so a game nobody
    // has mentioned in a month clears itself without a job to do it.
    if (!fresh(vote, at)) {
      entry.votes.delete(visitor)
      scheduleSave()
      continue
    }

    counts[vote.kind]++

    if (vote.kind !== 'works' && vote.at > counts.lastReport) counts.lastReport = vote.at
  }

  return counts
}

function verdictFor(entry: GameRecord, counts: Counts): Verdict {
  const flags = counts.broken + counts.keyboard + counts.other
  const support = counts.works + Math.min(entry.long, provenWeight)

  if (flags === 0) {
    // Somebody saying it works, or having stayed long enough to have proved it,
    // is worth more than a pattern - so it is asked first.
    if (support > 0) return 'working'

    // With nothing said either way, the only thing left is whether people stay.
    // Everybody leaving inside a minute, enough times over, is the complaint
    // nobody filed.
    if (entry.visits >= autoSessions && entry.short / entry.visits >= autoBounceRate) return 'suspect'

    return 'unknown'
  }

  // The case this whole thing is built around: one person says it is broken,
  // everybody else is playing it. That is not a broken game.
  if (support >= flags * disputeRatio) return 'working'

  if (flags >= confirmFlags && flags > support) {
    // What they agree on matters: a game that loads and ignores the keyboard
    // is a different problem from one that never loads, and the fix is not
    // the same either.
    return counts.keyboard > counts.broken + counts.other ? 'keyboard' : 'broken'
  }

  return 'reported'
}

export interface Report {
  id: string
  verdict: Verdict
  broken: number
  keyboard: number
  other: number
  works: number
  flags: number
  support: number
  visits: number
  short: number
  long: number
  // Average measured visit. Zero visits is null rather than 0, so "nobody has
  // played it" reads differently from "everybody left at once".
  typical: number | null
  lastReport: number
  last: number
  you: Kind | null
}

function report(id: string, entry: GameRecord, at: number, visitor?: string): Report {
  const counts = count(entry, at)
  const you = visitor ? entry.votes.get(visitor) : undefined

  return {
    id,
    verdict: verdictFor(entry, counts),
    broken: counts.broken,
    keyboard: counts.keyboard,
    other: counts.other,
    works: counts.works,
    flags: counts.broken + counts.keyboard + counts.other,
    support: counts.works + Math.min(entry.long, provenWeight),
    visits: entry.visits,
    short: entry.short,
    long: entry.long,
    typical: entry.visits > 0 ? Math.round(entry.time / entry.visits) : null,
    lastReport: counts.lastReport,
    last: entry.last,
    you: you && fresh(you, at) ? you.kind : null
  }
}

// Worst first, so the page's first screen is the games somebody would want to
// know about before clicking one.
const severity: Record<Verdict, number> = { broken: 0, keyboard: 1, reported: 2, suspect: 3, working: 4, unknown: 5 }

function snapshot(at: number, visitor?: string) {
  const games = [...records].map(([id, entry]) => report(id, entry, at, visitor)).sort((a, b) => severity[a.verdict] - severity[b.verdict] || b.flags - a.flags || b.lastReport - a.lastReport || b.visits - a.visits)

  const counts = { broken: 0, keyboard: 0, suspect: 0, reported: 0, working: 0, unknown: 0 }

  for (const game of games) counts[game.verdict]++

  return {
    games: games.slice(0, maxListed),
    counts: {
      ...counts,
      // Games with something on file at all, which is what the counts above
      // are a breakdown of.
      tracked: games.length,
      reports: games.reduce((sum, game) => sum + game.flags, 0),
      confirmations: games.reduce((sum, game) => sum + game.works, 0)
    },
    // The page explains itself out of these rather than repeating numbers that
    // only live in this file's environment variables.
    rules: {
      confirmFlags,
      disputeRatio,
      provenWeight,
      bounceSeconds: bounceWindow / 1000,
      provenSeconds: provenWindow / 1000,
      voteDays,
      autoSessions
    }
  }
}

function vote(game: string, visitor: string, kind: Kind | 'none', at: number) {
  const entry = recordFor(game)

  if (!entry) return null

  if (kind === 'none') {
    // Somebody taking their report back, which has to be possible or the first
    // thing anybody does by accident is permanent.
    if (entry.votes.delete(visitor)) scheduleSave()

    return report(game, entry, at, visitor)
  }

  // One person, one word about one game: reporting twice is changing your
  // mind, not agreeing with yourself.
  if (!entry.votes.has(visitor) && entry.votes.size >= maxVoters) return report(game, entry, at, visitor)

  entry.votes.set(visitor, { kind, at })
  scheduleSave()

  return report(game, entry, at, visitor)
}

function start() {
  load()

  setInterval(sweep, sessionWindow).unref()

  // An orderly exit still gets to write, and reports are worth more than the
  // counts are: they are what somebody typed.
  process.on('exit', () => saveSync())
}

start()

// Mounted under /api/reports by both servers, so req.url here is the rest of
// the path: '/' for everything, '/report' to say something about one game.
export function handleReportsRequest(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url || '/', 'http://localhost')
  const id = url.searchParams.get('id')
  const game = url.searchParams.get('game')
  const visitor = id && idPattern.test(id) ? id : undefined

  let body: unknown

  if (url.pathname === '/report') {
    if (req.method !== 'POST') {
      res.statusCode = 405
      res.end()
      return
    }

    const kind = url.searchParams.get('kind')

    if (!visitor || !game || !gamePattern.test(game) || !(kind === 'none' || kinds.includes(kind as Kind))) {
      res.statusCode = 400
      res.end()
      return
    }

    const result = vote(game, visitor, kind as Kind | 'none', Date.now())

    if (!result) {
      // The ceiling on how many games are tracked, which only a flood of made
      // up names reaches.
      res.statusCode = 503
      res.end()
      return
    }

    body = { game: result }
  } else if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405
    res.end()
    return
  } else if (url.pathname === '/game') {
    if (!game || !gamePattern.test(game)) {
      res.statusCode = 400
      res.end()
      return
    }

    const entry = records.get(game)

    body = { game: entry ? report(game, entry, Date.now(), visitor) : null }
  } else if (url.pathname === '/') {
    body = snapshot(Date.now(), visitor)
  } else {
    res.statusCode = 404
    res.end()
    return
  }

  res.statusCode = 200
  res.setHeader('content-type', 'application/json')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(body))
}
