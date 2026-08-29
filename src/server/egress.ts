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

function positiveNumber(raw: string | undefined, fallback: number) {
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

// Rotation decides which proxy is picked next. Scope decides how long that pick
// lasts, and it is the setting that matters: picking per stream spreads load the
// widest, but it also means one page load leaves from thirty different
// addresses. Sites that tie a session to an IP break under that - YouTube signs
// its video URLs with the address that asked for them, and Google and Cloudflare
// pin their challenges the same way - which shows up as a page that loads and
// then stalls partway through. Holding one proxy for the life of a wisp
// connection keeps a browsing session on a single IP.
const rotation = (process.env.EGRESS_ROTATION || 'round-robin').toLowerCase()
const perConnection = (process.env.EGRESS_SCOPE || 'connection').toLowerCase() !== 'stream'

let nextProxy = 0

// A proxy that cannot open tunnels is worse for the pool than not having it at
// all: it keeps coming up in the rotation and every stream that lands on it
// stalls first. Count failures and take it out for a while once it has failed
// enough times in a row.
const failureLimit = positiveNumber(process.env.EGRESS_FAILURE_LIMIT, 3)
const benchDuration = positiveNumber(process.env.EGRESS_BENCH_SECONDS, 120) * 1000

const failureCounts = new Map<string, number>()
const benchedUntil = new Map<string, number>()

function isBenched(proxy: EgressProxy, now: number) {
  const until = benchedUntil.get(proxy.label)
  if (until === undefined) return false
  if (until > now) return true

  benchedUntil.delete(proxy.label)
  return false
}

export function reportSuccess(proxy: EgressProxy) {
  failureCounts.delete(proxy.label)
  benchedUntil.delete(proxy.label)
}

export function reportFailure(proxy: EgressProxy) {
  const count = (failureCounts.get(proxy.label) ?? 0) + 1

  if (count < failureLimit) {
    failureCounts.set(proxy.label, count)
    return
  }

  failureCounts.delete(proxy.label)
  benchedUntil.set(proxy.label, Date.now() + benchDuration)
  consola.warn(`Benching ${proxy.label} for ${Math.round(benchDuration / 1000)}s after ${count} failed connections`)
}

function selectFrom(proxies: EgressProxy[]): EgressProxy {
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

// exclude carries the proxies one connection attempt has already tried, so a
// retry does not land straight back on the proxy that just failed.
export function pickProxy(exclude?: ReadonlySet<string>): EgressProxy {
  const proxies = activeProxies()

  // Dialling out directly here would defeat the whole point, so refuse the
  // connection instead. This happens when the provider is the only source of
  // proxies and its very first fetch failed.
  if (!proxies.length) {
    throw new Error('no egress proxies are available')
  }

  const now = Date.now()
  const usable = proxies.filter((proxy) => !isBenched(proxy, now))
  const untried = exclude?.size ? usable.filter((proxy) => !exclude.has(proxy.label)) : usable

  // Each fallback gives up a preference rather than the connection. Every proxy
  // being benched, or having already been tried, is still better answered with a
  // long shot than with no attempt at all.
  return selectFrom(untried.length ? untried : usable.length ? usable : proxies)
}

// One wisp connection is one browser session's worth of traffic, and every
// stream it opens leases its proxy from the same session object. That is what
// keeps the whole session behind a single address.
export class EgressSession {
  private pinned: EgressProxy | null = null

  lease(exclude?: ReadonlySet<string>): EgressProxy {
    if (!perConnection) return pickProxy(exclude)

    const current = this.pinned
    // Keep the pin unless there is nothing pinned yet, the pinned proxy has been
    // benched, or a provider refresh has dropped it from the pool.
    const pinned = current && !isBenched(current, Date.now()) && activeProxies().some((proxy) => proxy.label === current.label) ? current : pickProxy(exclude)

    this.pinned = pinned

    // A retry inside a single stream borrows a different proxy without moving
    // the pin: one destination this proxy cannot reach is not a reason to change
    // the address the rest of the session is browsing from.
    return exclude?.has(pinned.label) ? pickProxy(exclude) : pinned
  }
}

// wisp-js constructs the socket class it is handed with only a hostname and a
// port, so the session has to be bound in here rather than passed through.
export function egressSocketClass(session: EgressSession) {
  return class SessionTCPSocket extends ProxiedTCPSocket {
    constructor(hostname: string, port: number) {
      super(hostname, port, session)
    }
  }
}

// Kept short because a failed attempt is now retried through another proxy
// instead of failing the request outright.
function connectTimeout() {
  return positiveNumber(process.env.EGRESS_TIMEOUT, 10000)
}

function connectAttempts() {
  return Math.floor(positiveNumber(process.env.EGRESS_ATTEMPTS, 3))
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
// the stream has ended and everything already buffered has been read.
class AsyncQueue<T> {
  private queue: T[] = []
  private waiting: (() => void)[] = []
  private ended = false

  constructor(readonly maxSize: number) {}

  put(item: T) {
    if (this.ended) return
    this.queue.push(item)
    this.waiting.shift()?.()
  }

  async get(): Promise<T | undefined> {
    // Looping rather than reading once means a wakeup that another caller got
    // to first parks again instead of reporting a false end of stream.
    while (true) {
      if (this.queue.length > 0) return this.queue.shift()
      if (this.ended) return undefined

      await new Promise<void>((resolve) => {
        this.waiting.push(resolve)
      })
    }
  }

  // The connection is gone, but what it managed to send before hanging up still
  // has to be delivered. Throwing it away truncates the reply mid TLS record and
  // the browser sits there waiting for the rest of a response that never comes,
  // which is what a page that loads halfway and then freezes looks like.
  end() {
    this.ended = true
    this.wake()
  }

  // The stream itself is being torn down, so nothing is left to read the rest.
  close() {
    this.ended = true
    this.queue = []
    this.wake()
  }

  private wake() {
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
  private readonly session: EgressSession

  constructor(
    readonly hostname: string,
    readonly port: number,
    session?: EgressSession
  ) {
    // A caller with no session of its own gets a private one, which is the old
    // behaviour of choosing a fresh proxy for every stream.
    this.session = session ?? new EgressSession()
  }

  async connect() {
    const attempts = connectAttempts()
    // Rented proxies fail often enough that one bad pick should not take the
    // request down with it, and the retry has to avoid the proxy that just
    // failed to reach this destination.
    const tried = new Set<string>()
    let failure: Error | null = null

    for (let attempt = 1; attempt <= attempts; attempt++) {
      // Throws when the pool is empty, which fails the stream rather than
      // quietly falling back to a direct connection.
      const proxy = this.session.lease(tried)
      tried.add(proxy.label)

      try {
        this.attach(await openTunnel(proxy, this.hostname, this.port))
        reportSuccess(proxy)
        return
      } catch (error) {
        reportFailure(proxy)
        // Name the proxy, not the destination, so a broken proxy is obvious.
        failure = new Error(`${proxy.label} could not reach ${this.hostname}:${this.port} - ${(error as Error).message}`)
        // Only the attempt that gives up is worth a warning; wisp-js logs that
        // one itself when the stream fails.
        consola.debug(`egress attempt ${attempt}/${attempts} failed - ${failure.message}`)
      }
    }

    throw failure ?? new Error(`could not reach ${this.hostname}:${this.port}`)
  }

  private attach(socket: net.Socket) {
    this.socket = socket

    socket.on('data', (data) => this.queue.put(data))
    socket.on('close', () => {
      // End rather than discard, so the tail of the response still reaches the
      // browser instead of being dropped along with the socket.
      this.queue.end()
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

  async recv() {
    return await this.queue.get()
  }

  async send(data: Uint8Array) {
    const socket = this.socket

    // The tunnel is already gone. Dropping the bytes quietly leaves the browser
    // waiting on the answer to a request that was never sent, so end the read
    // side too and let wisp tear the stream down and tell the client. End rather
    // than close: a client that writes while the response is still draining must
    // not cost it the rest of that response.
    if (!socket) {
      this.queue.end()
      return
    }

    await new Promise<void>((resolve) => {
      socket.write(data, () => resolve())
    })
  }

  async close() {
    // wisp only calls this while tearing the stream down, so anything still
    // buffered has nowhere left to go.
    this.queue.close()
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
