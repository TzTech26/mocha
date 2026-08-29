// A server that dies without saying anything is the hardest kind to fix, and
// that is what this one has been doing: the log shows a normal startup, then
// nothing, then a startup again. Two things are missing when that happens.
//
// The first is a cause of death. A process killed for using too much memory
// gets SIGKILL and prints nothing at all, which looks exactly like a crash
// whose stack trace went to a stream the platform did not capture. Printing
// our own last words through consola, on stdout with the rest of the log,
// tells those two apart.
//
// The second is what the server was holding when it went. A count of live
// connections, streams, memory and open sockets, once a minute, turns "it just
// stopped" into a line that says whether it ran out of memory, ran out of
// sockets, or was leaking streams for an hour beforehand.
import fs from 'node:fs'
import { consola } from 'consola'

// Seconds between health lines. 0 turns them off.
const period = Number(process.env.DIAGNOSTICS_SECONDS ?? 60)

let connections = 0
let streams = 0
let peakStreams = 0
let totalStreams = 0

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

function megabytes(bytes: number) {
  return Math.round(bytes / 1048576)
}

export function startDiagnostics() {
  if (period > 0) {
    consola.info(`Logging a health line every ${period}s`)

    setInterval(() => {
      const memory = process.memoryUsage()
      consola.info(`health: connections=${connections} streams=${streams} peak=${peakStreams} total=${totalStreams} rss=${megabytes(memory.rss)}MB buffers=${megabytes(memory.arrayBuffers)}MB descriptors=${openDescriptors()}`)
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
}
