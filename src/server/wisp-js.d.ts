// wisp-js ships as plain JavaScript, so declare the parts of the server
// entrypoint this project uses.
declare module '@mercuryworkshop/wisp-js/server' {
  import type { IncomingMessage } from 'node:http'
  import type { Socket } from 'node:net'

  interface WispOptions {
    hostname_blacklist: RegExp[] | null
    hostname_whitelist: RegExp[] | null
    port_blacklist: (number | [number, number])[] | null
    port_whitelist: (number | [number, number])[] | null
    allow_direct_ip: boolean
    allow_private_ips: boolean
    allow_loopback_ips: boolean
    stream_limit_per_host: number
    stream_limit_total: number
    allow_udp_streams: boolean
    allow_tcp_streams: boolean
    dns_ttl: number
    dns_method: 'lookup' | 'resolve' | ((hostname: string) => Promise<string>)
    dns_servers: string[] | null
    dns_result_order: 'verbatim' | 'ipv4first' | 'ipv6first'
    parse_real_ip: boolean
    parse_real_ip_from: string[]
    wisp_version: 1 | 2
    wisp_motd: string | null
  }

  // The stream socket wisp-js constructs per connection. Supplying a class with
  // this shape as TCPSocket is how outgoing connections get redirected.
  interface WispSocket {
    connect(): Promise<void>
    recv(): Promise<Uint8Array | undefined>
    send(data: Uint8Array): Promise<void>
    close(): Promise<void>
    pause(): void
    resume(): void
  }

  interface ConnectionOptions {
    TCPSocket?: new (hostname: string, port: number) => WispSocket
    UDPSocket?: new (hostname: string, port: number) => WispSocket
  }

  export const server: {
    options: WispOptions
    routeRequest(request: IncomingMessage, socket: Socket, head: Buffer, connectionOptions?: ConnectionOptions): void
  }
}
