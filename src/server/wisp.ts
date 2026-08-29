// Wisp is the tunnel the browser opens to reach the internet: every proxied
// request becomes a TCP stream this server dials. wisp-js lets us supply the
// class it uses for those streams, which is where the egress proxies plug in.
import type { IncomingMessage } from 'node:http'
import type { Socket } from 'node:net'
import { server as wisp } from '@mercuryworkshop/wisp-js/server'
import { consola } from 'consola'
import { ProxiedTCPSocket, egressProxies } from './egress'

const proxying = egressProxies.length > 0

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

  consola.info(`Egress through ${egressProxies.length} proxy(s): ${egressProxies.map((proxy) => proxy.label).join(', ')}`)
  consola.info('UDP streams are disabled while egress proxies are in use')
} else {
  consola.warn('EGRESS_PROXIES is not set - proxied traffic leaves from this server, so sites can see its public IP')
}

export function routeWisp(request: IncomingMessage, socket: Socket, head: Buffer) {
  wisp.routeRequest(request, socket, head, proxying ? { TCPSocket: ProxiedTCPSocket } : {})
}
