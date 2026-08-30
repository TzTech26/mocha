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

  constructor(readonly maxSize: number) {}

  put(item: T) {
    this.queue.push(item)
    this.waiting.shift()?.()
  }

  async get(): Promise<T | undefined> {
    if (this.queue.length > 0) return this.queue.shift()

    await new Promise<void>((resolve) => {
      this.waiting.push(resolve)
    })

    return this.queue.shift()
  }

  close() {
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
    // Throws when the pool is empty, which fails the stream rather than
    // quietly falling back to a direct connection.
    const proxies = pickProxies(connectAttempts())

    let socket: net.Socket | null = null
    const failures: string[] = []

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
        // Name the proxy, not the destination, so a broken proxy is obvious.
        failures.push(`${proxy.label} - ${(error as Error).message}`)
        if (Date.now() >= deadline) break
      }
    }

    // Every proxy we were willing to try refused or timed out, so this is the
    // destination's problem or the pool's, not one unlucky exit. List them all:
    // one line naming one proxy reads like that proxy is broken.
    if (!socket) {
      throw new Error(`could not reach ${this.hostname}:${this.port} through ${failures.length} proxy(s) - ${failures.join('; ')}`)
    }

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
