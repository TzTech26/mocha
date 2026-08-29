// Pulls the egress proxy pool from Webshare's API instead of pasting a list
// into the environment by hand. https://apidocs.webshare.io/proxy-list
//
// The key lives in WEBSHARE_API_KEY and is never logged or included in an
// error message, since those end up in deploy logs.
import { consola } from 'consola'
import { type EgressProtocol, type EgressProxy, setProviderProxies } from './egress'

const apiOrigin = 'https://proxy.webshare.io'
const listUrl = `${apiOrigin}/api/v2/proxy/list/`

export const webshareApiKey = process.env.WEBSHARE_API_KEY
export const webshareEnabled = Boolean(webshareApiKey)

// direct hands back one address per proxy, which is what a pool wants.
const mode = process.env.WEBSHARE_MODE || 'direct'

// Webshare's list endpoint returns the HTTP port. Only override this if your
// plan exposes the same endpoints over SOCKS5.
const protocol = (process.env.WEBSHARE_PROTOCOL || 'http') as EgressProtocol

const refreshHours = Number(process.env.WEBSHARE_REFRESH_HOURS || 24)
const requestTimeout = Number(process.env.WEBSHARE_TIMEOUT || 30000)

// Enough for a very large plan, and a stop against a paging loop.
const maxPages = 100
const pageSize = 100

interface WebshareProxy {
  proxy_address: string
  port: number
  username: string
  password: string
  valid?: boolean
}

interface WebsharePage {
  next: string | null
  results: WebshareProxy[]
}

async function fetchPage(url: string, key: string): Promise<WebsharePage> {
  const response = await fetch(url, {
    headers: { Authorization: `Token ${key}` },
    signal: AbortSignal.timeout(requestTimeout)
  })

  if (!response.ok) {
    // The status is safe to surface; the body may echo the request back.
    throw new Error(`Webshare API responded with ${response.status} ${response.statusText}`)
  }

  return (await response.json()) as WebsharePage
}

export async function fetchWebshareProxies(): Promise<EgressProxy[]> {
  if (!webshareApiKey) throw new Error('WEBSHARE_API_KEY is not set')

  const proxies: EgressProxy[] = []
  let url: string | null = `${listUrl}?mode=${encodeURIComponent(mode)}&page=1&page_size=${pageSize}`

  for (let page = 0; url && page < maxPages; page++) {
    const body: WebsharePage = await fetchPage(url, webshareApiKey)

    for (const result of body.results ?? []) {
      // Webshare marks proxies it has stopped being able to verify. Taking only
      // the valid ones is what drops the dead ones on each refresh.
      if (result.valid === false) continue
      if (!result.proxy_address || !result.port) continue

      proxies.push({
        protocol,
        host: result.proxy_address,
        port: result.port,
        username: result.username,
        password: result.password,
        label: `${protocol}://${result.proxy_address}:${result.port}`
      })
    }

    // next is a URL from the response body, so confirm it still points at the
    // API before following it.
    url = body.next && new URL(body.next).origin === apiOrigin ? body.next : null
  }

  return proxies
}

// Replaces the pool with a fresh list. A failure leaves the previous list in
// place: a provider outage should not take the proxy down with it.
export async function refreshWebshareProxies() {
  try {
    const proxies = await fetchWebshareProxies()

    if (!proxies.length) {
      consola.warn('Webshare returned no usable proxies, keeping the previous list')
      return
    }

    setProviderProxies(proxies)
    consola.info(`Loaded ${proxies.length} proxies from Webshare`)
  } catch (error) {
    consola.warn(`Could not refresh the Webshare proxy list, keeping the previous one - ${(error as Error).message}`)
  }
}

export function startWebshareRefresh() {
  if (!webshareEnabled) return

  void refreshWebshareProxies()

  const interval = refreshHours * 60 * 60 * 1000
  // Not a reason to hold the process open on its own.
  setInterval(() => void refreshWebshareProxies(), interval).unref()

  consola.info(`Refreshing the Webshare proxy list every ${refreshHours}h`)
}
