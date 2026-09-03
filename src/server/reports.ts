// Which games are working, and how anybody would know.
//
// A game here is a folder on somebody else's CDN, loaded through a proxy, into
// an iframe. There are a few hundred of them and no way to test one from the
// server: fetching index.html says the file is there, not that the game runs,
// keeps its keyboard, or is playable at all. The only instrument Mocha has is
// the people playing, so this listens to them two ways.
//
// A game is only ever called broken by somebody flagging it. That is the whole
// of the reporting half: the flag in the viewer's control bar, a line of text
// saying what is wrong, and it is on the reports page. Anybody who disagrees
// says it works for them, and enough of them answers the report - one person
// flagging a game everybody else is playing does not take it down.
//
// The other half only ever speaks for a game, never against one. The status
// ping already says which game each tab is on, so how long people stay is
// measurable, and a visit that runs long is a game that demonstrably ran. A
// short visit is not the reverse of that and is counted as nothing: people
// leave games because they are bored far more often than because they are
// broken, and guessing between the two would flag the wrong games.
//
// What is left is an ordering problem, because a list of flagged games is only
// useful if the ones worth fixing are at the top. Reports are what sort it, and
// between games with the same number of them, how many people the game happens
// to: the same fault on one everybody opens comes first.
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

// What somebody types about a game, which everybody else then reads. Long
// enough to say what is wrong with it, short enough that nobody is writing
// anything else in there.
const maxNote = Number(process.env.REPORTS_MAX_NOTE ?? 200)

// How many of those the page is shown per game. The newest are the ones that
// describe the game as it is now.
const shownNotes = Number(process.env.REPORTS_SHOWN_NOTES ?? 4)

// A report is about a game as it was that week. Games are hosted somewhere
// else and get fixed without anybody telling us, so a report stops counting
// after this and a game nobody has complained about lately goes back to being
// unreported rather than staying flagged forever.
const voteDays = Number(process.env.REPORTS_VOTE_DAYS ?? 30)

// A visit this long is a game that ran. There is deliberately no number for
// the other direction: a short visit says nothing about the game.
const provenWindow = Number(process.env.REPORTS_PROVEN_SECONDS ?? 300) * 1000

// Browsers ping every 30 seconds, so a tab silent for this long has gone and
// its visit can be measured. Kept in step with STATUS_ACTIVE_SECONDS.
const sessionWindow = Number(process.env.REPORTS_SESSION_SECONDS ?? 90) * 1000

// How much heavier the evidence for a game has to be than the reports against
// it before those reports are treated as answered. Two people saying it works
// against one saying it does not is the case this exists for.
const disputeRatio = Number(process.env.REPORTS_DISPUTE_RATIO ?? 2)

// Long visits are evidence, but they are old evidence: a game that broke this
// morning still has every long visit it ever held. So they can outweigh a
// report or two and never a crowd of them.
const provenWeight = Number(process.env.REPORTS_PROVEN_WEIGHT ?? 3)

// How many games the reports page is handed. Flagged games come first, so the
// cap only ever drops ones nobody has said anything about.
const maxListed = Number(process.env.REPORTS_MAX_LISTED ?? 250)

const day = 86400000

// Ids and game names come off a query string, so they are only ever stored
// after they look like the ones we hand out and the ones in games.json.
const idPattern = /^[a-zA-Z0-9-]{8,64}$/
const gamePattern = /^[a-zA-Z0-9._-]{1,64}$/

// Line breaks and control characters in something everybody else is going to
// read: taken out rather than kept, since all they can do on a list of games
// is make one report take up the page.
const noisePattern = /\p{C}+/gu

// What somebody can say about a game. 'works' is the other half of the
// system: without a way to disagree, one person could flag anything.
export type Kind = 'broken' | 'works'

const kinds: Kind[] = ['broken', 'works']

// flagged - somebody says it is broken and nothing outweighs them
// working - nobody has flagged it, or the flags are outweighed
// unknown - nothing said, and nobody has stayed long enough to say otherwise
export type Verdict = 'flagged' | 'working' | 'unknown'

interface Vote {
  kind: Kind
  at: number
  // What they typed, on a report. Everybody reads it, so it is cleaned on the
  // way in and capped.
  note?: string
}

interface GameRecord {
  votes: Map<string, Vote>
  // Measured visits, in whole numbers rather than a list of them: how many
  // there have been says how much a report on this game matters, and how many
  // ran long says the game works.
  visits: number
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

  const created: GameRecord = { votes: new Map(), visits: 0, long: 0, time: 0, last: 0 }
  records.set(game, created)

  return created
}

// Somebody's own words, on their way to being shown to everybody else.
function clean(note: string) {
  return note.replace(noisePattern, ' ').replace(/\s+/g, ' ').trim().slice(0, maxNote)
}

function serialize() {
  return JSON.stringify({
    version: 2,
    games: [...records].map(([id, entry]) => [id, entry.visits, entry.long, entry.time, entry.last, [...entry.votes].map(([visitor, vote]) => [visitor, vote.kind, vote.at, vote.note ?? ''])])
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

    for (const row of saved?.games ?? []) {
      // The first version of this file counted short visits and sorted reports
      // into kinds. Neither is here any more: a short visit means nothing, and
      // every kind of problem is now just a report with what they typed.
      const [id, visits, long, time, last, votes] = saved.version === 2 ? row : [row[0], row[1], row[3], row[4], row[5], row[6]]

      if (typeof id !== 'string' || !gamePattern.test(id)) continue

      const entry: GameRecord = {
        votes: new Map(),
        visits: Number(visits) || 0,
        long: Number(long) || 0,
        time: Number(time) || 0,
        last: Number(last) || 0
      }

      for (const [visitor, kind, at, note] of votes ?? []) {
        if (typeof visitor !== 'string' || !idPattern.test(visitor)) continue

        entry.votes.set(visitor, {
          kind: kind === 'works' ? 'works' : 'broken',
          at: Number(at) || 0,
          note: typeof note === 'string' && note ? clean(note) : undefined
        })
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
// all we know. Both round downwards, which only ever costs a game the chance
// to prove itself.
function closeSession(session: Session, at: number, left: boolean) {
  const entry = recordFor(session.game)

  if (!entry) return

  const held = Math.max(0, (left ? at : session.last) - session.first)

  entry.visits++
  entry.time += held
  entry.last = Math.max(entry.last, session.last || at)

  if (held >= provenWindow) entry.long++

  scheduleSave()
}

// Called by the status ping for every tab, with the game it is on or nothing
// when it is not on one. Everything the measured half of this knows comes
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

export interface Note {
  text: string
  at: number
}

interface Counts {
  flags: number
  works: number
  lastReport: number
  notes: Note[]
}

function count(entry: GameRecord, at: number): Counts {
  const counts: Counts = { flags: 0, works: 0, lastReport: 0, notes: [] }

  for (const [visitor, vote] of entry.votes) {
    // Counting is also when expired reports are forgotten, so a game nobody
    // has mentioned in a month clears itself without a job to do it.
    if (!fresh(vote, at)) {
      entry.votes.delete(visitor)
      scheduleSave()
      continue
    }

    if (vote.kind === 'works') {
      counts.works++
      continue
    }

    counts.flags++

    if (vote.at > counts.lastReport) counts.lastReport = vote.at
    if (vote.note) counts.notes.push({ text: vote.note, at: vote.at })
  }

  // Newest first, and only a few of them: the page is a list of games, not a
  // thread about each one.
  counts.notes.sort((a, b) => b.at - a.at)
  counts.notes.length = Math.min(counts.notes.length, shownNotes)

  return counts
}

function supportFor(entry: GameRecord, counts: Counts) {
  return counts.works + Math.min(entry.long, provenWeight)
}

function verdictFor(entry: GameRecord, counts: Counts): Verdict {
  const support = supportFor(entry, counts)

  if (counts.flags === 0) return support > 0 ? 'working' : 'unknown'

  // The case this whole thing is built around: one person says it is broken,
  // everybody else is playing it. That is not a broken game.
  if (support >= counts.flags * disputeRatio) return 'working'

  return 'flagged'
}

export interface Report {
  id: string
  verdict: Verdict
  flags: number
  works: number
  support: number
  visits: number
  long: number
  // Average measured visit. No visits is null rather than 0, so "nobody has
  // played it" reads differently from "everybody was in and out".
  typical: number | null
  notes: Note[]
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
    flags: counts.flags,
    works: counts.works,
    support: supportFor(entry, counts),
    visits: entry.visits,
    long: entry.long,
    typical: entry.visits > 0 ? Math.round(entry.time / entry.visits) : null,
    notes: counts.notes,
    lastReport: counts.lastReport,
    last: entry.last,
    you: you && fresh(you, at) ? you.kind : null
  }
}

const severity: Record<Verdict, number> = { flagged: 0, working: 1, unknown: 2 }

function snapshot(at: number, visitor?: string) {
  // Which flagged game is worth looking at first: how many people reported it,
  // and between games reported by the same number, how many people play it -
  // the same fault on a game everybody opens is worth fixing before one on a
  // game nobody has opened this month.
  const games = [...records].map(([id, entry]) => report(id, entry, at, visitor)).sort((a, b) => severity[a.verdict] - severity[b.verdict] || b.flags - a.flags || b.visits - a.visits || b.lastReport - a.lastReport)

  const counts = { flagged: 0, working: 0, unknown: 0 }

  for (const game of games) counts[game.verdict]++

  return {
    games: games.slice(0, maxListed),
    counts: {
      ...counts,
      // Games with something on file at all, which is what the counts above
      // are a breakdown of.
      tracked: games.length,
      // Flagged games that everybody else is playing anyway, which the page
      // keeps apart from the ones nothing answers.
      disputed: games.filter((game) => game.verdict === 'working' && game.flags > 0).length,
      reports: games.reduce((sum, game) => sum + game.flags, 0),
      confirmations: games.reduce((sum, game) => sum + game.works, 0)
    },
    // The page explains itself out of these rather than repeating numbers that
    // only live in this file's environment variables.
    rules: {
      disputeRatio,
      provenWeight,
      provenSeconds: provenWindow / 1000,
      voteDays,
      maxNote
    }
  }
}

function vote(game: string, visitor: string, kind: Kind | 'none', at: number, note?: string) {
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

  const text = kind === 'broken' && note ? clean(note) : ''

  entry.votes.set(visitor, { kind, at, note: text || undefined })
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

    const result = vote(game, visitor, kind as Kind | 'none', Date.now(), url.searchParams.get('note') ?? undefined)

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
