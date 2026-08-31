// A server that dies without saying anything is the hardest kind to fix, and
// that is what this one has been doing: the log shows a normal startup, then
// nothing, then a startup again. Two things are missing when that happens.
//
// The first is a cause of death. A process killed for using too much memory
// gets SIGKILL and prints nothing at all, which looks exactly like a crash
// whose stack trace went to a stream the platform did not capture. Printing
// our own last words through consola, on stdout with the rest of the log,
// tells those two apart: a restart with no line before it is the kill nobody
// gets to log.
//
// The second is what the server was holding when it went. A count of live
// connections, streams, memory and open sockets, once a minute, turns "it just
// stopped" into a line that says whether it ran out of memory, ran out of
// sockets, or was leaking streams for an hour beforehand. Those counts are
// only readable next to the ceiling they are heading for, so the limits are
// read at startup and printed alongside them.
import fs from 'node:fs'
import os from 'node:os'
import { consola } from 'consola'

// Seconds between health lines. 0 turns them off.
const period = Number(process.env.DIAGNOSTICS_SECONDS ?? 60)

// An idle server prints the same line every minute for as long as nobody is
// using it, and a day of that is 1440 copies of connections=0 to scroll past
// before reaching the traffic anyone is actually reading the log for. The
// counts have not changed, so neither has anything the line was written to
// say. Repeating one only every half hour keeps the proof that the process is
// alive without burying the part that is not repetition.
const idlePeriod = Number(process.env.DIAGNOSTICS_IDLE_SECONDS ?? 1800)

// Fraction of either limit that is close enough to be worth a warning of its
// own, rather than a number buried in a health line nobody is reading yet.
const pressure = 0.8

let connections = 0
let streams = 0
let peakStreams = 0
let totalStreams = 0
let warned = false
let lastLine = ''
let lastPrinted = 0

export function connectionOpened() {
  connections++
}

export function connectionClosed() {
  connections = Math.max(0, connections - 1)
}

export function streamOpened() {
  streams++
  totalStreams++
  if (streams > peakStreams) peakStreams = streams
}

export function streamClosed() {
  streams = Math.max(0, streams - 1)
}

// Every socket, file and pipe the process holds. This is the number that runs
// into the open file limit, and hitting that limit stops the server answering
// anything at all - static files and games included, not just proxied traffic.
function openDescriptors() {
  try {
    return fs.readdirSync('/proc/self/fd').length
  } catch {
    return -1
  }
}

// The soft limit is the one that starts failing accept() and connect(), so it
// is the ceiling worth printing. 0 means it could not be read, or is unlimited.
function descriptorLimit() {
  try {
    const line = fs
      .readFileSync('/proc/self/limits', 'utf8')
      .split('\n')
      .find((entry) => entry.startsWith('Max open files'))
    const limit = Number(line?.split(/\s{2,}/)[1])

    return Number.isFinite(limit) && limit > 0 ? limit : 0
  } catch {
    return 0
  }
}

// What the process is killed for exceeding: the container's memory limit when
// there is one, the machine's memory when there is not. A cgroup that is not
// capped reports a number far larger than the machine has, so anything at or
// above the physical total is not a limit worth reporting.
function memoryLimit() {
  const total = os.totalmem()

  for (const file of ['/sys/fs/cgroup/memory.max', '/sys/fs/cgroup/memory/memory.limit_in_bytes']) {
    try {
      const limit = Number(fs.readFileSync(file, 'utf8').trim())
      if (Number.isFinite(limit) && limit > 0 && limit < total) return limit
    } catch {}
  }

  return total
}

function megabytes(bytes: number) {
  return Math.round(bytes / 1048576)
}

export function startDiagnostics() {
  // Limits are fixed for the life of the process, so read them once.
  const descriptors = descriptorLimit()
  const memoryCeiling = memoryLimit()

  if (period > 0) {
    consola.info(`Logging a health line every ${period}s, against ${megabytes(memoryCeiling)}MB of memory and ${descriptors || 'unlimited'} open files`)

    setInterval(() => {
      const memory = process.memoryUsage()
      const openFiles = openDescriptors()
      const line = `health: connections=${connections} streams=${streams} peak=${peakStreams} total=${totalStreams} rss=${megabytes(memory.rss)}MB/${megabytes(memoryCeiling)}MB buffers=${megabytes(memory.arrayBuffers)}MB descriptors=${openFiles}${descriptors ? `/${descriptors}` : ''}`

      // Only a server holding nothing and having done nothing since the last
      // line is repeating itself. Anything live is worth a line every time,
      // because memory and descriptors move underneath counts that do not.
      const counts = `${connections}/${streams}/${totalStreams}`
      const quiet = connections === 0 && streams === 0 && counts === lastLine
      const due = Date.now() - lastPrinted >= idlePeriod * 1000

      if (!quiet || due) {
        consola.info(line)
        lastPrinted = Date.now()
      }

      lastLine = counts

      // Say it plainly the first time either ceiling comes into view, since
      // the health line above is the sort of thing that gets read after the
      // outage rather than before it. Once per approach, not once a minute.
      const nearMemory = memory.rss >= memoryCeiling * pressure
      const nearDescriptors = descriptors > 0 && openFiles >= descriptors * pressure

      if (nearMemory || nearDescriptors) {
        if (!warned) {
          warned = true
          consola.warn(
            nearMemory
              ? `memory is at ${megabytes(memory.rss)}MB of ${megabytes(memoryCeiling)}MB - a kill here prints nothing, so treat a silent restart after this line as an out of memory kill`
              : `open files are at ${openFiles} of ${descriptors} - past the limit the server stops answering every request, not just proxied ones`
          )
        }
      } else {
        warned = false
      }

      // Peak is per interval, so a burst shows up in the line it happened in
      // rather than being carried forever.
      peakStreams = streams
    }, period * 1000).unref()
  }

  // Keep the existing behaviour of dying, but say why on the way out and on
  // the same stream as every other line here.
  process.on('uncaughtException', (error) => {
    consola.error(`fatal: uncaught exception - ${error.stack ?? error}`)
    process.exit(1)
  })

  // Node's default for an unhandled rejection is to crash, so match it rather
  // than quietly surviving in a state nobody has reasoned about.
  process.on('unhandledRejection', (reason) => {
    consola.error(`fatal: unhandled rejection - ${(reason as Error)?.stack ?? reason}`)
    process.exit(1)
  })

  // An orderly shutdown - a deploy, a restart, a stop - arrives as a signal and
  // otherwise exits as quietly as a crash does. Saying which signal it was is
  // what separates "the platform restarted us" from "we died".
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
      consola.info(`exiting on ${signal}`)
      process.exit(signal === 'SIGINT' ? 130 : 143)
    })
  }
}
