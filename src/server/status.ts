// Everything the status page knows, and the only place any of it is counted.
// Express serves this in production and Vite's dev server serves it through the
// plugin in vite.config.ts, so it has to stand on its own.
//
// Nobody signs in, so people are counted the only way a proxy can: a browser
// makes up a random id, keeps it in local storage, and sends it with a ping
// every half minute. The ping says which kind of page the tab is on, which is
// what lets somebody sitting on the status page watching the numbers be left
// out of the numbers they are watching.
//
// Two things counted here outlive the process - how many people have ever used
// Mocha, and how much of the time it has been up - so both are written to disk,
// the counts when they change and the uptime record on a clock. Those files are
// the only durable state Mocha has: without a volume under them, every deploy
// starts the totals from zero and the outage nobody was there to see goes
// unmeasured.
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import { consola } from 'consola'

const startedAt = Date.now()

// A browser pings every 30 seconds, so this window forgives one missed ping.
// Dropping somebody after a single slow request would make the live counts
// flicker on a page that is watching them.
const activeWindow = Number(process.env.STATUS_ACTIVE_SECONDS ?? 90) * 1000

// One record per person ever seen, which is a structure that only grows, so it
// has a ceiling. Past it the oldest are forgotten and one of those people
// returning is counted as new - a slightly high total is worth more than a map
// that grows until the process is killed for the memory it took.
const maxVisitors = Number(process.env.STATUS_MAX_VISITORS ?? 100000)

// Ids are made up by whoever is calling, so a script can invent as many as it
// likes. These cap what that costs in memory; the counts it inflates are only
// ever read by the status page.
const maxPresence = Number(process.env.STATUS_MAX_ACTIVE ?? 50000)
const maxGames = Number(process.env.STATUS_MAX_GAMES ?? 2000)

// Which games a person has played is kept on their record, so a game they have
// played before is not counted as another player of it. Somebody who plays more
// than this many different games starts counting as a new player again.
const maxGamesPerVisitor = Number(process.env.STATUS_MAX_GAMES_PER_VISITOR ?? 100)

const dataFile = path.resolve(process.env.STATUS_DATA_FILE || '.cache/status.json')

// The uptime record is the one thing that has to be written on a clock rather
// than when it changes, because what it records is that time passed. Keeping it
// beside the counts rather than inside them means an idle server with a long
// history rewrites a few hundred bytes every heartbeat instead of every visitor
// it has ever seen.
const uptimeFile = `${dataFile}.uptime`
const persistEnabled = process.env.STATUS_PERSIST !== '0'

// Seconds to wait before writing after something changes, so a rush of
// arrivals is one write rather than one per person.
const saveDelay = Number(process.env.STATUS_SAVE_SECONDS ?? 60) * 1000

// How often the process says it is still alive, which is what makes the uptime
// record survive a kill that gets no chance to write anything.
const heartbeatPeriod = Number(process.env.STATUS_HEARTBEAT_SECONDS ?? 30) * 1000

// A restart quicker than this counts as up: a deploy that swaps the container in
// a few seconds is not an outage anybody saw, and calling it one would make the
// percentage a measure of how often Mocha is deployed.
const downtimeGrace = heartbeatPeriod * 2

// Counting every visitor record is too much work to do on every request, so the
// per-day figures are worked out again only when something has changed, and
// never more often than the floor. The period is what catches the day rolling
// over underneath a page that is sitting open.
const rollupFloor = 2000
const rollupPeriod = 30000

const historyHours = 24

// How many games the status page is sent. The home page asks for fewer.
const topGameCount = Number(process.env.STATUS_TOP_GAMES ?? 8)

const day = 86400000
const hour = 3600000

type Presence = 'site' | 'proxy' | 'game' | 'status'

interface Tab {
  visitor: string
  at: number
  kind: Presence
  game?: string
}

interface Visitor {
  // Days, not timestamps: the two of them are what say whether somebody came
  // back, and a day is the smallest unit that question needs.
  first: number
  last: number
  plays: number
  games: string[]
}

interface Game {
  plays: number
  players: number
  day: number
  today: number
  last: number
}

interface Hour {
  hour: number
  peak: number
  plays: number
}

const visitors = new Map<string, Visitor>()
// Keyed by tab rather than by person, so one window on the status page and
// another on a game are two entries and the person is counted as here.
const tabs = new Map<string, Tab>()
const games = new Map<string, Game>()
let history: Hour[] = []

let totalUsers = 0
let totalPlays = 0

// What the file is for: numbers that would otherwise start again from nothing
// every time the process does.
const lifetime = {
  since: startedAt,
  up: 0,
  down: 0,
  restarts: 0,
  longest: 0,
  lastSeen: 0,
  peak: 0,
  peakAt: 0
}

let saveTimer: NodeJS.Timeout | null = null

// Ids and game names come off a query string, so they are only ever stored
// after they look like the ones we hand out and the ones in games.json.
const idPattern = /^[a-zA-Z0-9-]{8,64}$/
const gamePattern = /^[a-zA-Z0-9._-]{1,64}$/

function dayOf(at: number) {
  return Math.floor(at / day)
}

function hourOf(at: number) {
  return Math.floor(at / hour)
}

// The bucket the last day of activity is drawn from. Hours with nothing in them
// are absent rather than zero, so the page can tell "nobody was here" from "the
// server was not running".
function bucketFor(at: number): Hour {
  const index = hourOf(at)
  const last = history[history.length - 1]

  if (last?.hour === index) return last

  const bucket = { hour: index, peak: 0, plays: 0 }
  history.push(bucket)

  if (history.length > historyHours) history.splice(0, history.length - historyHours)

  return bucket
}

function loadVersionOne(saved: { total?: unknown; visitors?: unknown }) {
  // The first version of this file knew a total and a list of ids and nothing
  // else. Their days are unknown, so they are recorded as first seen the day
  // the file was read: they stop counting towards "returning", which is the
  // honest answer for people we cannot say that about.
  const today = dayOf(Date.now())

  if (Number.isFinite(saved.total)) totalUsers = Math.max(0, Math.floor(saved.total as number))

  if (Array.isArray(saved.visitors)) {
    for (const id of saved.visitors) {
      if (typeof id === 'string' && idPattern.test(id)) {
        visitors.set(id, { first: today, last: today, plays: 0, games: [] })
      }
    }
  }
}

// Whichever copy of the lifetime was written last is the one that knows how long
// this has been running, and the sidecar is usually it.
function loadUptime() {
  try {
    const saved = JSON.parse(fs.readFileSync(uptimeFile, 'utf8'))

    if (Number.isFinite(saved?.lastSeen) && saved.lastSeen > lifetime.lastSeen) Object.assign(lifetime, saved)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      consola.warn(`status: could not read ${uptimeFile} - ${error}`)
    }
  }
}

function load() {
  if (!persistEnabled) return

  try {
    const saved = JSON.parse(fs.readFileSync(dataFile, 'utf8'))

    if (saved?.version !== 2) {
      loadVersionOne(saved ?? {})
      loadUptime()
      return
    }

    totalUsers = Math.max(0, Math.floor(saved.users ?? 0))
    totalPlays = Math.max(0, Math.floor(saved.plays ?? 0))

    if (saved.lifetime) Object.assign(lifetime, saved.lifetime)

    for (const [id, first, last, plays, played] of saved.visitors ?? []) {
      if (typeof id !== 'string' || !idPattern.test(id)) continue

      visitors.set(id, {
        first: Number(first) || 0,
        last: Number(last) || 0,
        plays: Number(plays) || 0,
        games: Array.isArray(played) ? played.filter((game: unknown) => typeof game === 'string') : []
      })
    }

    for (const [id, plays, players, recordedDay, today, last] of saved.games ?? []) {
      if (typeof id !== 'string' || !gamePattern.test(id)) continue

      games.set(id, {
        plays: Number(plays) || 0,
        players: Number(players) || 0,
        day: Number(recordedDay) || 0,
        today: Number(today) || 0,
        last: Number(last) || 0
      })
    }

    if (Array.isArray(saved.history)) {
      history = saved.history.filter((bucket: Hour) => Number.isFinite(bucket?.hour)).slice(-historyHours)
    }
  } catch (error) {
    // A missing file is the normal first start, so only say something when the
    // file is there and unreadable.
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      consola.warn(`status: could not read ${dataFile}, starting the counts from zero - ${error}`)
    }
  }

  loadUptime()
}

// Time this process has been up since the last time that was written down.
// Every path that records the lifetime goes through here, so a restart or an
// orderly exit never throws away the minutes since the last heartbeat - and
// lastSeen always means "the last moment we know it was answering", which is
// what the next start measures its downtime from.
function settle(at = Date.now()) {
  if (at > lifetime.lastSeen) {
    lifetime.up += at - lifetime.lastSeen
    lifetime.lastSeen = at
  }

  const current = at - startedAt
  if (current > lifetime.longest) lifetime.longest = current
}

function serialize() {
  settle()

  return JSON.stringify({
    version: 2,
    users: totalUsers,
    plays: totalPlays,
    lifetime,
    history,
    visitors: [...visitors].map(([id, visitor]) => [id, visitor.first, visitor.last, visitor.plays, visitor.games]),
    games: [...games].map(([id, game]) => [id, game.plays, game.players, game.day, game.today, game.last])
  })
}

async function save() {
  if (!persistEnabled) return

  const temporary = `${dataFile}.${randomUUID()}.part`

  try {
    await fsp.mkdir(path.dirname(dataFile), { recursive: true })
    // Write beside the target and rename, so a read that lands mid-write never
    // sees half a file and throws every count away.
    await fsp.writeFile(temporary, serialize())
    await fsp.rename(temporary, dataFile)
  } catch (error) {
    await fsp.rm(temporary, { force: true })
    // The heartbeat asks for another write shortly, so a failure here costs the
    // last minute of counting rather than all of it.
    consola.warn(`status: could not write ${dataFile} - ${error}`)
  }
}

async function saveUptime() {
  if (!persistEnabled) return

  settle()

  const temporary = `${uptimeFile}.${randomUUID()}.part`

  try {
    await fsp.mkdir(path.dirname(uptimeFile), { recursive: true })
    await fsp.writeFile(temporary, JSON.stringify(lifetime))
    await fsp.rename(temporary, uptimeFile)
  } catch (error) {
    await fsp.rm(temporary, { force: true })
    consola.warn(`status: could not write ${uptimeFile} - ${error}`)
  }
}

// Used where the write cannot wait for the event loop: the moment a restart is
// noticed, and on the way out.
function saveSync() {
  if (!persistEnabled) return

  try {
    fs.mkdirSync(path.dirname(dataFile), { recursive: true })
    fs.writeFileSync(dataFile, serialize())
  } catch (error) {
    consola.warn(`status: could not write ${dataFile} - ${error}`)
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

function touch(id: string, at: number) {
  const today = dayOf(at)
  const existing = visitors.get(id)

  if (existing) {
    if (existing.last !== today) {
      existing.last = today
      rollupStale = true
      scheduleSave()
    }

    return existing
  }

  const visitor: Visitor = { first: today, last: today, plays: 0, games: [] }

  visitors.set(id, visitor)
  totalUsers++
  rollupStale = true

  if (visitors.size > maxVisitors) {
    const oldest = visitors.keys().next()
    if (!oldest.done) visitors.delete(oldest.value)
  }

  scheduleSave()

  return visitor
}

function ping(tab: string, id: string, kind: Presence, game?: string) {
  if (tabs.size >= maxPresence && !tabs.has(tab)) return

  tabs.set(tab, { visitor: id, at: Date.now(), kind, game })
  touch(id, Date.now())
}

function play(id: string, name: string) {
  const at = Date.now()
  const visitor = touch(id, at)
  const today = dayOf(at)

  let game = games.get(name)

  if (!game) {
    if (games.size >= maxGames) return
    game = { plays: 0, players: 0, day: today, today: 0, last: at }
    games.set(name, game)
  }

  if (game.day !== today) {
    game.day = today
    game.today = 0
  }

  game.plays++
  game.today++
  game.last = at

  // Their first ever play makes them one of the people who have played
  // something, which is a figure the rollup counts.
  if (visitor.plays === 0) rollupStale = true

  visitor.plays++
  totalPlays++

  // The first time this person has opened this game, which is what separates
  // people who played it from people who kept coming back to it.
  if (!visitor.games.includes(name)) {
    game.players++
    if (visitor.games.length < maxGamesPerVisitor) visitor.games.push(name)
  }

  bucketFor(at).plays++
  scheduleSave()
}

// Who is here now. Counted per person rather than per tab, so somebody with
// three tabs open is one of us.
function live(at: number) {
  const active = new Set<string>()
  const watching = new Set<string>()
  const playing = new Set<string>()
  const proxying = new Set<string>()
  const perGame = new Map<string, Set<string>>()

  for (const [tab, entry] of tabs) {
    if (at - entry.at > activeWindow) {
      tabs.delete(tab)
      continue
    }

    // The whole point of the kind: a tab watching this page is somebody
    // reading the numbers, not somebody using Mocha.
    if (entry.kind === 'status') {
      watching.add(entry.visitor)
      continue
    }

    active.add(entry.visitor)

    if (entry.kind === 'proxy' || entry.kind === 'game') proxying.add(entry.visitor)

    if (entry.kind === 'game' && entry.game) {
      playing.add(entry.visitor)

      const players = perGame.get(entry.game) ?? new Set<string>()
      players.add(entry.visitor)
      perGame.set(entry.game, players)
    }
  }

  // Somebody with the status page open in one tab and a game in another is
  // here, not watching.
  for (const visitor of active) watching.delete(visitor)

  const bucket = bucketFor(at)
  if (active.size > bucket.peak) bucket.peak = active.size

  if (active.size > lifetime.peak) {
    lifetime.peak = active.size
    lifetime.peakAt = at
    scheduleSave()
  }

  return { active: active.size, watching: watching.size, playing: playing.size, proxying: proxying.size, perGame }
}

let rollup = { returning: 0, newToday: 0, activeToday: 0, activeWeek: 0, players: 0 }
let rolledUpAt = 0
let rolledUpDay = -1
let rollupStale = true

function people(at: number) {
  const today = dayOf(at)
  const current = !rollupStale && rolledUpDay === today && at - rolledUpAt < rollupPeriod

  // Throttled rather than scheduled: a first play on a quiet server shows up in
  // seconds instead of waiting out a window, and a busy one still only counts
  // everybody twice a minute at worst.
  if (rolledUpAt && (current || at - rolledUpAt < rollupFloor)) return rollup

  const counts = { returning: 0, newToday: 0, activeToday: 0, activeWeek: 0, players: 0 }

  for (const visitor of visitors.values()) {
    // Seen on a later day than the day they arrived: they came back.
    if (visitor.last > visitor.first) counts.returning++
    if (visitor.first === today) counts.newToday++
    if (visitor.last === today) counts.activeToday++
    if (visitor.last >= today - 6) counts.activeWeek++
    if (visitor.plays > 0) counts.players++
  }

  rollup = counts
  rolledUpAt = at
  rolledUpDay = today
  rollupStale = false

  return rollup
}

function topGames(at: number, limit: number, perGame?: Map<string, Set<string>>) {
  const today = dayOf(at)

  return [...games]
    .sort(([, a], [, b]) => b.plays - a.plays || b.last - a.last)
    .slice(0, limit)
    .map(([id, game]) => ({
      id,
      plays: game.plays,
      players: game.players,
      // Plays beyond the first by each person: how much this one is come back to
      // rather than how many people tried it once.
      repeats: Math.max(0, game.plays - game.players),
      today: game.day === today ? game.today : 0,
      playing: perGame?.get(id)?.size ?? 0
    }))
}

function snapshot() {
  const at = Date.now()
  const now = live(at)
  const counts = people(at)

  // The accumulated total is only written on the heartbeat, so add what this
  // process has been up since then or the figure lags by up to that long.
  const up = lifetime.up + (at - lifetime.lastSeen)
  const measured = up + lifetime.down
  const current = at - startedAt

  return {
    now: {
      active: now.active,
      watching: now.watching,
      playing: now.playing,
      proxying: now.proxying
    },
    people: {
      total: totalUsers,
      returning: counts.returning,
      newToday: counts.newToday,
      activeToday: counts.activeToday,
      activeWeek: counts.activeWeek,
      peak: lifetime.peak,
      peakAt: lifetime.peakAt
    },
    games: {
      plays: totalPlays,
      // A rolling day rather than since midnight: the history only goes back 24
      // hours, and "in the last day" is the question anybody reading this has.
      playsDay: history.filter((bucket) => bucket.hour > hourOf(at) - historyHours).reduce((sum, bucket) => sum + bucket.plays, 0),
      players: counts.players,
      tracked: games.size,
      top: topGames(at, topGameCount, now.perGame)
    },
    uptime: {
      current,
      longest: Math.max(lifetime.longest, current),
      since: lifetime.since,
      restarts: lifetime.restarts,
      up,
      down: lifetime.down,
      // Undefined rather than 100 before anything has been measured, so a fresh
      // server does not claim a perfect record it has not earned.
      percent: measured > 0 ? (up / measured) * 100 : null
    },
    history,
    startedAt
  }
}

// Being alive is itself the thing worth recording: a timestamp written half a
// minute ago is what turns the next silent kill into a measured gap rather than
// a guess. The counts are left alone - they are written when they change.
function heartbeat() {
  void saveUptime()
}

function start() {
  load()

  if (lifetime.lastSeen) {
    const gap = startedAt - lifetime.lastSeen

    // Everything between the last heartbeat and now is time this was not
    // answering anybody, except a gap short enough to be a deploy swapping one
    // container for another.
    if (gap > downtimeGrace) {
      lifetime.down += gap
      consola.warn(`status: down for ${Math.round(gap / 1000)}s before this start`)
    } else if (gap > 0) {
      lifetime.up += gap
    }

    lifetime.restarts++
  }

  lifetime.lastSeen = startedAt

  // Written now rather than on the next heartbeat, because the process most
  // worth having a record of is the one that dies seconds after starting: a
  // crash loop that never lived long enough to save would otherwise leave no
  // sign that it restarted at all.
  saveSync()

  setInterval(heartbeat, heartbeatPeriod).unref()

  // A kill with no warning writes nothing, but an orderly exit still can, and
  // the counting since the last heartbeat is worth one synchronous write.
  process.on('exit', () => saveSync())
}

start()

// Mounted under /api/status by both servers, so req.url here is the rest of the
// path: '/' for everything, '/ping' to say somebody is still here, '/play' when
// a game is opened, '/games' for the popular list the home page shows.
export function handleStatusRequest(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url || '/', 'http://localhost')
  const id = url.searchParams.get('id')
  const game = url.searchParams.get('game')

  let body: unknown

  if (url.pathname === '/ping' || url.pathname === '/play') {
    if (req.method !== 'POST') {
      res.statusCode = 405
      res.end()
      return
    }

    if (id && idPattern.test(id)) {
      if (url.pathname === '/play') {
        if (game && gamePattern.test(game)) play(id, game)
      } else {
        const kind = url.searchParams.get('kind')
        const tab = url.searchParams.get('tab')
        const known: Presence[] = ['site', 'proxy', 'game', 'status']

        if (tab && idPattern.test(tab) && known.includes(kind as Presence)) {
          ping(tab, id, kind as Presence, game && gamePattern.test(game) ? game : undefined)
        }
      }
    }

    body = snapshot()
  } else if (url.pathname === '/games' && (req.method === 'GET' || req.method === 'HEAD')) {
    const limit = Math.min(20, Math.max(1, Number(url.searchParams.get('limit')) || 5))

    body = { top: topGames(Date.now(), limit) }
  } else if (url.pathname === '/' && (req.method === 'GET' || req.method === 'HEAD')) {
    body = snapshot()
  } else {
    res.statusCode = 404
    res.end()
    return
  }

  res.statusCode = 200
  res.setHeader('content-type', 'application/json')
  // Counts a minute stale are worse than no counts, and a page that polls is
  // exactly what a proxy in front of us would happily cache.
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(body))
}
