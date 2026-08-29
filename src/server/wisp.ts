// Wisp is the tunnel the browser opens to reach the internet: every proxied
// request becomes a TCP stream this server dials. wisp-js lets us supply the
// class it uses for those streams, which is where the egress proxies plug in.
import type { IncomingMessage } from 'node:http'
import type { Socket } from 'node:net'
import { server as wisp } from '@mercuryworkshop/wisp-js/server'
import { consola } from 'consola'
import { connectionClosed, connectionOpened } from './diagnostics'
import { ProxiedTCPSocket, staticProxies } from './egress'
import { startWebshareRefresh, webshareEnabled } from './webshare'

// Webshare counts even before its first fetch lands. Deciding this up front
// means a slow or failed initial fetch cannot silently downgrade the server to
// direct connections: streams fail until the pool fills instead.
const proxying = staticProxies.length > 0 || webshareEnabled

if (proxying) {
  // UDP cannot ride through an HTTP CONNECT tunnel, and letting it fall back to
  // a direct socket would hand the destination the real IP anyway. Turning it
  // off is what keeps "no direct connections" actually true.
  wisp.options.allow_udp_streams = false

  // wisp-js resolves the destination locally to check it against the private IP
  // filter, even though the proxy does the real lookup. Pointing that at a
  // resolver of your choosing keeps the browsing out of the ISP's DNS logs.
  const dnsServers = process.env.EGRESS_DNS_SERVERS?.split(/[\s,]+/).filter(Boolean)
  if (dnsServers?.length) {
    wisp.options.dns_method = 'resolve'
    wisp.options.dns_servers = dnsServers
  }

  if (staticProxies.length) {
    consola.info(`Egress through ${staticProxies.length} configured proxy(s): ${staticProxies.map((proxy) => proxy.label).join(', ')}`)
  }

  consola.info('UDP streams are disabled while egress proxies are in use')
  startWebshareRefresh()
} else {
  consola.warn('No egress proxies are configured - proxied traffic leaves from this server, so sites can see its public IP')
}

export function routeWisp(request: IncomingMessage, socket: Socket, head: Buffer) {
  connectionOpened()
  // The upgraded socket outlives the wisp connection object, so count it down
  // from the socket rather than from anything wisp-js exposes.
  socket.once('close', connectionClosed)

  wisp.routeRequest(request, socket, head, proxying ? { TCPSocket: ProxiedTCPSocket } : {})
}
