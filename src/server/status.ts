// The three numbers the status page shows, kept in one place because two
// different servers ask for them: Express in production, and Vite's dev server
// through the plugin in vite.config.ts.
//
// Uptime is the easy one - the process knows when it started. The user counts
// are harder, because nobody signs in. A browser makes up a random id, keeps it
// in local storage, and pings with it every half minute: an id pinging recently
// is somebody on the site now, and the set of ids ever seen is how many people
// have used it at all. No IP address, no account, nothing that says who the id
// belongs to.
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import { consola } from 'consola'

const startedAt = Date.now()

// A browser pings every 30 seconds, so this window forgives one missed ping.
// Dropping somebody after a single slow request would make the active count
// flicker on a page that is watching it.
const activeWindow = Number(process.env.STATUS_ACTIVE_SECONDS ?? 90) * 1000

// The total has to remember every id it has counted, or a visitor returning
// tomorrow is counted twice, so it is a set that only ever grows. Past this
// ceiling the oldest ids are forgotten and one of those visitors returning does
// get counted again - a slightly high total is worth more than a set that grows
// until the process is killed for the memory it took.
const maxVisitors = Number(process.env.STATUS_MAX_VISITORS ?? 200000)

// Ids are made up by whoever is calling, so a script can invent as many as it
// likes. This caps what that costs us in memory; the counts it inflates are
// only ever read by the status page.
const maxActive = Number(process.env.STATUS_MAX_ACTIVE ?? 50000)

// Restarts are routine - a deploy, an out of memory kill - and a total that
// resets to zero on each one is not a total. Mount a volume on the directory to
// keep it across deploys, the same as the CDN cache.
const dataFile = path.resolve(process.env.STATUS_DATA_FILE || '.cache/status.json')
const persistEnabled = process.env.STATUS_PERSIST !== '0'

// Seconds to wait before writing after the total moves, so a burst of arrivals
// is one write rather than one per person.
const saveDelay = Number(process.env.STATUS_SAVE_SECONDS ?? 15) * 1000

// Insertion ordered, which is what lets the oldest id be the one dropped at the
// ceiling.
const visitors = new Set<string>()
const active = new Map<string, number>()

let total = 0
let saveTimer: NodeJS.Timeout | null = null

// Ids come off the query string, so they are only ever stored after they look
// like the ones we hand out.
const idPattern = /^[a-zA-Z0-9-]{8,64}$/

function load() {
  if (!persistEnabled) return

  try {
    const saved = JSON.parse(fs.readFileSync(dataFile, 'utf8'))

    if (Number.isFinite(saved?.total)) total = Math.max(0, Math.floor(saved.total))

    if (Array.isArray(saved?.visitors)) {
      for (const id of saved.visitors) {
        if (typeof id === 'string' && idPattern.test(id)) visitors.add(id)
      }
    }
  } catch (error) {
    // A missing file is the normal first start, so only say something when the
    // file is there and unreadable.
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      consola.warn(`status: could not read ${dataFile}, starting the visitor total from zero - ${error}`)
    }
  }
}

async function save() {
  const temporary = `${dataFile}.${randomUUID()}.part`

  try {
    await fsp.mkdir(path.dirname(dataFile), { recursive: true })
    // Write beside the target and rename, so a read that lands mid-write never
    // sees half a file and throws the total away.
    await fsp.writeFile(temporary, JSON.stringify({ total, visitors: [...visitors] }))
    await fsp.rename(temporary, dataFile)
  } catch (error) {
    await fsp.rm(temporary, { force: true })
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

function record(id: string) {
  if (active.size < maxActive || active.has(id)) active.set(id, Date.now())

  if (visitors.has(id)) return

  visitors.add(id)
  total++

  if (visitors.size > maxVisitors) {
    const oldest = visitors.values().next()
    if (!oldest.done) visitors.delete(oldest.value)
  }

  scheduleSave()
}

function snapshot() {
  const now = Date.now()

  // Pruning here rather than on a timer keeps this to one moving part: the map
  // only holds ids that pinged within the window because it is cleaned every
  // time somebody looks.
  for (const [id, lastSeen] of active) {
    if (now - lastSeen > activeWindow) active.delete(id)
  }

  return {
    active: active.size,
    total,
    uptime: Math.floor((now - startedAt) / 1000),
    startedAt
  }
}

load()

// Mounted under /api/status by both servers, so req.url here is the rest of the
// path: '/' for the numbers, '/ping' to say somebody is still here.
export function handleStatusRequest(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url || '/', 'http://localhost')

  if (url.pathname === '/ping') {
    if (req.method !== 'POST') {
      res.statusCode = 405
      res.end()
      return
    }

    const id = url.searchParams.get('id')
    if (id && idPattern.test(id)) record(id)
  } else if (url.pathname !== '/' || (req.method !== 'GET' && req.method !== 'HEAD')) {
    res.statusCode = 404
    res.end()
    return
  }

  res.statusCode = 200
  res.setHeader('content-type', 'application/json')
  // Counts that are a minute stale are worse than no counts, and a page that
  // polls is exactly what a proxy in front of us would happily cache.
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(snapshot()))
}
