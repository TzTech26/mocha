// The sites the viewer opens as themselves rather than through the proxy.
//
// Everything else goes through the proxy, and that is the point of Mocha. These
// are the exceptions: sites run by the people who run Mocha, where there is
// nobody to hide the visit from and the proxy would only cost speed. A site is
// matched by its host, so it goes direct however it was opened - from the games
// list, a shortcut, a bookmark or typed into the address bar - and nothing
// typed or linked can add another one. The site has to allow being framed by
// Mocha's own address, since it is loaded into the viewer's frame as it is.
//
// game is the site's id in games.json when it is a game, so the viewer can
// offer to report it and the status page can count who is playing it, the same
// as a game on the CDN.
interface DirectSite {
  host: string
  game?: string
}

const sites: DirectSite[] = [{ host: 'hotlap.online', game: 'hot-lap' }]

// What gets here is whatever was put in the route: a full address from a game
// or a shortcut, or a bare host somebody typed.
function parse(target: string) {
  for (const candidate of [target, `https://${target}`]) {
    try {
      const url = new URL(candidate)

      if (url.protocol === 'https:' || url.protocol === 'http:') return url
    } catch {
      // Not an address, or not one written this way.
    }
  }

  return null
}

function siteFor(url: URL) {
  return sites.find((site) => url.hostname === site.host || url.hostname.endsWith(`.${site.host}`))
}

// The address to put in the frame when the target is one of the sites above,
// and null for everything else. Always https: Mocha is served over it, and a
// plain http frame inside it would be blocked as mixed content.
export function directUrl(target: string) {
  const url = parse(target)

  if (!url || !siteFor(url)) return null

  url.protocol = 'https:'

  return url.href
}

export function directGame(target: string) {
  const url = parse(target)

  return (url && siteFor(url)?.game) ?? null
}
