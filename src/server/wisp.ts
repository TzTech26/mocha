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

  // wisp-js resolves every destination locally, only to check the answer
  // against its private IP filter - the proxy is the one that does the lookup
  // that matters, from a network this server never touches. So the local
  // answer decides nothing about where the connection goes, and when the two
  // disagree it is the local one that wins the argument and refuses the
  // stream.
  //
  // They disagree on any host whose resolver filters: a Pi-hole, a filtering
  // upstream resolver, a hosts file. Those answer 0.0.0.0 for ad and tracker
  // domains, which reads as an unspecified address, which reads as a private
  // one - so wisp-js logs "refusing to create a stream" and drops it, while
  // the client keeps sending on a stream that no longer exists. A page loses
  // exactly the requests that host has a blocklist entry for, and says
  // nothing about it.
  //
  // Answering with the hostname skips the lookup entirely. It costs nothing:
  // a literal IP destination is still checked, since wisp-js never resolves
  // one, and no address this server could have resolved was going to be
  // dialled from here anyway. It also keeps the destination out of this
  // machine's DNS traffic for real, which the resolver setting below only
  // ever did for the operators who configured it.
  const dnsServers = process.env.EGRESS_DNS_SERVERS?.split(/[\s,]+/).filter(Boolean)
  if (dnsServers?.length) {
    wisp.options.dns_method = 'resolve'
    wisp.options.dns_servers = dnsServers
  } else {
    wisp.options.dns_method = async (hostname: string) => hostname
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
