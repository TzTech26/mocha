// Every page a visitor opens is fetched by this server over a raw TCP socket,
// so without an upstream proxy the destination site sees this machine's public
// IP. Anyone can read it off a site like ipinfo.io from inside the proxy. That
// matters most when the server runs from a home connection behind a tunnel:
// the tunnel hides the inbound address, not the outbound one.
//
// Set EGRESS_PROXIES to send those connections through proxies you control
// instead. With nothing set the server dials out directly, exactly as before.
import net from 'node:net'
import tls from 'node:tls'
import { consola } from 'consola'
import { SocksClient } from 'socks'
import { streamClosed, streamOpened } from './diagnostics'

export type EgressProtocol = 'socks4' | 'socks5' | 'http' | 'https'

export interface EgressProxy {
  protocol: EgressProtocol
  host: string
  port: number
  username?: string
  password?: string
  // Safe to log: the credentials are stripped out.
  label: string
}

const defaultPorts: Record<EgressProtocol, number> = {
  socks4: 1080,
  socks5: 1080,
  http: 8080,
  https: 443
}

// socks5h is curl's spelling for "let the proxy resolve the hostname". We always
// do that, so it is just an alias.
const protocolAliases: Record<string, EgressProtocol> = {
  socks: 'socks5',
  socks4: 'socks4',
  socks4a: 'socks4',
  socks5: 'socks5',
  socks5h: 'socks5',
  http: 'http',
  https: 'https'
}

export function parseProxies(raw: string | undefined): EgressProxy[] {
  if (!raw) return []

  return raw
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((entry) => {
      // A bare host:port is common in the lists proxy sellers hand out.
      const withScheme = entry.includes('://') ? entry : `socks5://${entry}`
      let url: URL

      try {
        url = new URL(withScheme)
      } catch {
        throw new Error(`EGRESS_PROXIES contains an entry that is not a URL: ${entry}`)
      }

      const protocol = protocolAliases[url.protocol.replace(':', '').toLowerCase()]
      if (!protocol) {
        throw new Error(`EGRESS_PROXIES entry ${url.protocol}// is not a supported proxy type. Use socks5, socks4, http, or https.`)
      }

      if (!url.hostname) {
        throw new Error(`EGRESS_PROXIES contains an entry with no host: ${entry}`)
      }

      const port = url.port ? Number(url.port) : defaultPorts[protocol]
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error(`EGRESS_PROXIES contains an entry with an invalid port: ${entry}`)
      }

      return {
        protocol,
        host: url.hostname,
        port,
        username: url.username ? decodeURIComponent(url.username) : undefined,
        password: url.password ? decodeURIComponent(url.password) : undefined,
        label: `${protocol}://${url.hostname}:${port}`
      }
    })
}

// Proxies written out in the environment. These are always in the pool.
export const staticProxies = parseProxies(process.env.EGRESS_PROXIES)

// Proxies fetched from a provider's API. Replaced wholesale on every refresh so
// that proxies the provider has dropped stop being used, and left untouched
// when a refresh fails so the server keeps working off the last good list.
let providerProxies: EgressProxy[] = []

export function setProviderProxies(proxies: EgressProxy[]) {
  providerProxies = proxies
}

export function activeProxies(): EgressProxy[] {
  return [...staticProxies, ...providerProxies]
}

// Rotating per connection spreads load and makes each stream look like a
// different client. Sticky keeps one proxy for the process, which some sites
// prefer because the IP stops changing mid-session.
const rotation = (process.env.EGRESS_ROTATION || 'round-robin').toLowerCase()

let nextProxy = 0

function pickProxy(): EgressProxy {
  const proxies = activeProxies()

  // Dialling out directly here would defeat the whole point, so refuse the
  // connection instead. This happens when the provider is the only source of
  // proxies and its very first fetch failed.
  if (!proxies.length) {
    throw new Error('no egress proxies are available')
  }

  if (rotation === 'random') {
    return proxies[Math.floor(Math.random() * proxies.length)]
  }
  if (rotation === 'sticky') {
    return proxies[0]
  }

  const proxy = proxies[nextProxy % proxies.length]
  nextProxy = (nextProxy + 1) % proxies.length
  return proxy
}

// How many proxies a single stream is allowed to try before it gives up.
function connectAttempts() {
  const value = Number(process.env.EGRESS_ATTEMPTS || 3)
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 3
}

// A pool this size always has a few members that cannot reach a given
// destination - the provider swapped the address out, the exit is rate limited,
// the destination is refusing that IP - and the rotation hands them out like
// any other. One stream landing on one of them used to fail the request
// outright, which is a dead image or a missing API response on a page that was
// otherwise fine, and a page whose content depends on that response has nothing
// to show.
function pickProxies(count: number): EgressProxy[] {
  const proxies = activeProxies()

  // Dialling out directly here would defeat the whole point, so refuse the
  // connection instead. This happens when the provider is the only source of
  // proxies and its very first fetch failed.
  if (!proxies.length) {
    throw new Error('no egress proxies are available')
  }

  const wanted = Math.max(1, Math.min(count, proxies.length))
  const chosen: EgressProxy[] = []

  // Go through the rotation for each one so the pool still gets spread evenly,
  // but stop asking for variety rather than spinning for it: sticky only ever
  // offers a single proxy, and random can keep returning ones already picked.
  for (let attempt = 0; chosen.length < wanted && attempt < wanted * 4; attempt++) {
    const proxy = pickProxy()
    if (!chosen.includes(proxy)) chosen.push(proxy)
  }

  return chosen.length ? chosen : [pickProxy()]
}

// A game page asks for the same set of advertising, analytics and video-ad
// hosts on every single load, and a page that keeps running asks again on a
// timer. None of those requests are the game: they are what the game's SDK
// reports back to its publisher. Through a metered pool every one of them
// costs a dial and the bandwidth of whatever comes back, which is why a
// half-hour of one game can spend more of the pool on ad calls than on the
// game itself.
//
// Refusing them here rather than in the browser is what makes the saving real.
// A page-side blocker still lets the request leave; this stops it before a
// proxy is picked, so a blocked host costs nothing at all. To the page it
// looks the way an ad blocker does - the request fails and the game carries
// on, because a game whose ad call fails still runs.
const adHosts = [
  'doubleclick.net',
  'googlesyndication.com',
  'googletagservices.com',
  'googletagmanager.com',
  'google-analytics.com',
  'analytics.google.com',
  'adservice.google.com',
  'imasdk.googleapis.com',
  'pagead2.googleadservices.com',
  'amazon-adsystem.com',
  'adnxs.com',
  'adsafeprotected.com',
  'moatads.com',
  'casalemedia.com',
  'criteo.com',
  'criteo.net',
  'openx.net',
  'pubmatic.com',
  'rubiconproject.com',
  'scorecardresearch.com',
  'sentry.io',
  'bugsnag.com',
  'mixpanel.com',
  'segment.io',
  'unityads.unity3d.com'
]

// Set EGRESS_BLOCK_ADS=0 to spend the pool on these after all, and EGRESS_BLOCK
// to add hosts of your own. Both match a host exactly or any subdomain of it.
const blockedHosts = [...(process.env.EGRESS_BLOCK_ADS === '0' ? [] : adHosts), ...(process.env.EGRESS_BLOCK ?? '').split(/[\s,]+/).filter(Boolean)].map((host) => host.toLowerCase().replace(/^\.|\.$/g, ''))

export function isBlocked(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, '')

  return blockedHosts.some((entry) => host === entry || host.endsWith(`.${entry}`))
}

// Naming a blocked host once is enough to show what is being refused. Saying
// it on every request would replace the traffic we just stopped with a log
// line per request, which is the same storm in a different file.
const announced = new Set<string>()

// A destination that cannot be reached is not reached any faster the second
// time, and a page does not stop asking: the log that prompted this shows the
// same four hosts retried every twelve seconds for minutes, each retry
// spending EGRESS_ATTEMPTS dials of the pool on an answer that was never going
// to change. Holding a failed destination back for a while turns that from a
// cost per retry into a cost per window.
//
// Only refusals count. A proxy that answers CONNECT with an error status has
// looked the destination up and told us it could not get there - when every
// proxy we tried says that, the destination is the problem. A timeout says
// nothing about the destination, so it never puts one in here.
const failureBase = Number(process.env.EGRESS_FAILURE_TTL || 60000)
const failureMax = Number(process.env.EGRESS_FAILURE_MAX || 900000)

interface Penalty {
  until: number
  wait: number
}

const penalties = new Map<string, Penalty>()

function heldBack(key: string) {
  const penalty = penalties.get(key)
  if (!penalty) return 0

  const remaining = penalty.until - Date.now()

  return remaining > 0 ? remaining : 0
}

// An entry outlives its own hold, so that a destination which fails again is
// held longer the next time - somewhere unreachable for an hour is asked about
// four times an hour rather than three hundred. That also means nothing
// removes entries on its own. A page pointed at enough
// dead destinations would grow this map for as long as the process runs, so
// forget the ones whose hold has expired once there are enough to be worth
// forgetting. The cost is that a host nobody has asked about in a while starts
// again from the base wait, which is the right answer for one that has since
// come back.
const penaltyLimit = 1000

function penalise(key: string, hostname: string) {
  if (penalties.size >= penaltyLimit) {
    const now = Date.now()
    for (const [entry, penalty] of penalties) {
      if (penalty.until <= now) penalties.delete(entry)
    }
  }

  const previous = penalties.get(key)
  const wait = previous ? Math.min(previous.wait * 2, failureMax) : failureBase

  penalties.set(key, { until: Date.now() + wait, wait })
  consola.warn(`every proxy refused ${hostname} - not trying it again for ${Math.round(wait / 1000)}s`)
}

function reached(key: string) {
  penalties.delete(key)
}

// Long enough for a request that is already on its way to arrive at a stream
// that is about to end, short enough that the page is not left waiting.
const deadEndGrace = 250

function connectTimeout() {
  const value = Number(process.env.EGRESS_TIMEOUT || 20000)
  return Number.isFinite(value) && value > 0 ? value : 20000
}

// Opens the tunnel and hands back a socket that is already talking to the
// destination. The hostname is passed through unresolved so the proxy does the
// DNS lookup, which keeps the destination out of this machine's DNS traffic.
async function openHttpTunnel(proxy: EgressProxy, hostname: string, port: number): Promise<net.Socket> {
  const socket = await new Promise<net.Socket>((resolve, reject) => {
    const onError = (error: Error) => reject(error)

    const pending = proxy.protocol === 'https' ? tls.connect({ host: proxy.host, port: proxy.port, servername: proxy.host }, () => resolve(pending)) : net.connect({ host: proxy.host, port: proxy.port }, () => resolve(pending))

    pending.setTimeout(connectTimeout(), () => pending.destroy(new Error('timed out connecting to the proxy')))
    pending.once('error', onError)
  })

  const headers = [`CONNECT ${hostname}:${port} HTTP/1.1`, `Host: ${hostname}:${port}`]

  if (proxy.username) {
    const credentials = Buffer.from(`${proxy.username}:${proxy.password ?? ''}`).toString('base64')
    headers.push(`Proxy-Authorization: Basic ${credentials}`)
  }

  socket.write(`${headers.join('\r\n')}\r\n\r\n`)

  // Read just the CONNECT response. Anything after the blank line is already
  // payload from the destination, so it has to be put back on the stream.
  await new Promise<void>((resolve, reject) => {
    let response = Buffer.alloc(0)

    const cleanup = () => {
      socket.removeListener('data', onData)
      socket.removeListener('error', onError)
      socket.removeListener('close', onClose)
      socket.setTimeout(0)
    }

    const onData = (chunk: Buffer) => {
      response = Buffer.concat([response, chunk])
      const end = response.indexOf('\r\n\r\n')

      if (end === -1) {
        // A proxy that never sends the terminator would otherwise buffer forever.
        if (response.length > 64 * 1024) {
          cleanup()
          socket.destroy()
          reject(new Error('the proxy sent an oversized CONNECT response'))
        }
        return
      }

      const status = Number(response.subarray(0, response.indexOf('\r\n')).toString().split(' ')[1])
      cleanup()

      if (status !== 200) {
        socket.destroy()
        reject(new Error(`the proxy refused CONNECT with status ${status || 'unknown'}`))
        return
      }

      // Nothing is reading the socket between here and the point where the
      // stream attaches its own handler. A flowing socket throws that data
      // away, including anything unshifted, so park it in the buffer instead.
      socket.pause()

      const leftover = response.subarray(end + 4)
      if (leftover.length) socket.unshift(leftover)
      resolve()
    }

    const onError = (error: Error) => {
      cleanup()
      reject(error)
    }

    const onClose = () => {
      cleanup()
      reject(new Error('the proxy closed the connection during CONNECT'))
    }

    socket.on('data', onData)
    socket.once('error', onError)
    socket.once('close', onClose)
    socket.setTimeout(connectTimeout(), () => socket.destroy(new Error('timed out waiting for the proxy to answer CONNECT')))
  })

  return socket
}

async function openSocksTunnel(proxy: EgressProxy, hostname: string, port: number): Promise<net.Socket> {
  const { socket } = await SocksClient.createConnection({
    proxy: {
      host: proxy.host,
      port: proxy.port,
      type: proxy.protocol === 'socks4' ? 4 : 5,
      userId: proxy.username,
      password: proxy.password
    },
    command: 'connect',
    // Passing the hostname rather than an IP asks the proxy to resolve it.
    destination: { host: hostname, port },
    timeout: connectTimeout()
  })

  return socket
}

export async function openTunnel(proxy: EgressProxy, hostname: string, port: number): Promise<net.Socket> {
  const socket = proxy.protocol === 'http' || proxy.protocol === 'https' ? await openHttpTunnel(proxy, hostname, port) : await openSocksTunnel(proxy, hostname, port)

  socket.setTimeout(0)
  socket.setNoDelay(true)
  // Stays paused until the stream attaches its data handler, so a destination
  // that speaks first does not lose its greeting.
  socket.pause()
  return socket
}

// Matches the queue wisp-js uses internally: get() resolves to undefined once
// close() has been called, which is how a stream signals that it ended.
class AsyncQueue<T> {
  private queue: T[] = []
  private waiting: (() => void)[] = []
  // close() only wakes the readers that are already waiting. A read that
  // arrives afterwards has nothing to wake it, so it would wait for a queue
  // nobody is going to write to again - the stream stays open holding a socket
  // that is already gone. Remembering that it closed is what lets that read
  // answer straight away.
  private closed = false

  constructor(readonly maxSize: number) {}

  put(item: T) {
    this.queue.push(item)
    this.waiting.shift()?.()
  }

  async get(): Promise<T | undefined> {
    if (this.queue.length > 0) return this.queue.shift()
    if (this.closed) return undefined

    await new Promise<void>((resolve) => {
      this.waiting.push(resolve)
    })

    return this.queue.shift()
  }

  close() {
    this.closed = true
    this.queue = []
    let resolve = this.waiting.shift()
    while (resolve) {
      resolve()
      resolve = this.waiting.shift()
    }
  }

  get size() {
    return this.queue.length
  }
}

// Same shape as the socket wisp-js uses by default, but the connection is made
// by an upstream proxy instead of this machine. wisp-js takes the class through
// the TCPSocket option, so it constructs one of these per stream.
export class ProxiedTCPSocket {
  private socket: net.Socket | null = null
  private paused = false
  private readonly queue = new AsyncQueue<Buffer>(128)

  constructor(
    readonly hostname: string,
    readonly port: number
  ) {}

  async connect() {
    const key = `${this.hostname}:${this.port}`

    if (isBlocked(this.hostname)) {
      if (!announced.has(this.hostname)) {
        announced.add(this.hostname)
        consola.info(`not spending the pool on ${this.hostname} - it is on the blocked list`)
      }

      return this.deadEnd()
    }

    if (heldBack(key)) return this.deadEnd()

    // Throws when the pool is empty, which fails the stream rather than
    // quietly falling back to a direct connection.
    const proxies = pickProxies(connectAttempts())

    let socket: net.Socket | null = null
    const failures: string[] = []

    // A proxy that answers CONNECT with an error status, or a SOCKS proxy that
    // rejects the connection, has tried the destination on our behalf and
    // failed. That is the only kind of failure that says anything about the
    // destination itself, so it is the only kind that holds one back.
    let refusals = 0

    // Retrying is only worth it while it is cheap. A proxy that refuses
    // CONNECT does so in a few hundred milliseconds, which leaves room for
    // another two; one that hangs until the connect timeout has already spent
    // everything the browser was going to wait, and trying two more would turn
    // a slow failure into a slower one. Spending the same budget either way is
    // what keeps this a fix rather than a trade.
    const deadline = Date.now() + connectTimeout()

    for (const proxy of proxies) {
      try {
        socket = await openTunnel(proxy, this.hostname, this.port)
        break
      } catch (error) {
        const message = (error as Error).message

        // Name the proxy, not the destination, so a broken proxy is obvious.
        failures.push(`${proxy.label} - ${message}`)
        if (/refused CONNECT|rejected connection/.test(message)) refusals++
        if (Date.now() >= deadline) break
      }
    }

    // Every proxy we were willing to try refused or timed out, so this is the
    // destination's problem or the pool's, not one unlucky exit. List them all:
    // one line naming one proxy reads like that proxy is broken.
    if (!socket) {
      if (refusals === failures.length) penalise(key, this.hostname)

      throw new Error(`could not reach ${this.hostname}:${this.port} through ${failures.length} proxy(s) - ${failures.join('; ')}`)
    }

    // Whatever was wrong with this destination is not wrong any more, so stop
    // holding it back.
    reached(key)

    this.socket = socket
    streamOpened()

    socket.on('data', (data) => this.queue.put(data))
    socket.on('close', () => {
      streamClosed()
      this.queue.close()
      this.socket = null
    })
    socket.on('error', (error) => {
      consola.warn(`egress stream to ${this.hostname}:${this.port} ended with an error - ${error.message}`)
    })
    socket.on('end', () => {
      if (!this.socket) return
      this.socket.destroy()
      this.socket = null
    })

    // openTunnel leaves the socket paused so nothing is dropped before this
    // point. An explicitly paused stream is not restarted by adding a data
    // handler, so start it flowing here.
    socket.resume()
  }

  // A stream we are refusing to spend a proxy on still has to end somehow.
  // Failing it makes wisp-js log the whole pool at warn level, which replaces
  // the traffic just saved with a wall of text about saving it, so end the
  // stream instead: nothing to read, nothing to send, and the page sees what
  // it would see from an ad blocker.
  //
  // Ending it on the next tick rather than this one is what keeps that quiet.
  // The browser sends its request bytes immediately behind the connect, and a
  // stream that has already gone makes wisp-js warn about a DATA packet for a
  // stream which doesn't exist - one warning per blocked request, which is the
  // noise this was written to avoid.
  private deadEnd() {
    setTimeout(() => this.queue.close(), deadEndGrace).unref()
  }

  async recv() {
    return await this.queue.get()
  }

  async send(data: Uint8Array) {
    const socket = this.socket
    if (!socket) return

    await new Promise<void>((resolve) => {
      socket.write(data, () => resolve())
    })
  }

  async close() {
    if (!this.socket) return
    this.socket.end()
    this.socket = null
  }

  pause() {
    if (this.queue.size >= this.queue.maxSize) {
      this.socket?.pause()
      this.paused = true
    }
  }

  resume() {
    if (!this.socket || !this.paused) return
    this.socket.resume()
    this.paused = false
  }
}
