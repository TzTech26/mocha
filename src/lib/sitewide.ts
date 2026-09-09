import { siteWideAds } from './ads'

// Loaded once per page load, not once per navigation: these scripts install a
// handler for the whole document, and injecting a second copy on every route
// change is how one click turns into four popunders.
let loaded = false

// Nothing is enabled at the moment, so this loads nothing today - see the note
// in lib/ads.ts for what these did to the page, and what to change in the
// dashboards before switching one back on.
//
// The gate is the same one the rails use: the games list, and the viewer, which
// covers both a game being played and any page opened through the proxy. Every
// other screen - the home page above all, since it is the first thing a visitor
// sees - stays clean. Note that a script loaded here stays loaded for the rest
// of the visit, because navigating inside a single page app never reloads the
// document; the gate decides where these can start, not where they run.
const allowed = ['/games', '/route/']

export function loadSiteWideAds(pathname: string) {
  if (loaded) return
  if (!allowed.some((prefix) => pathname.startsWith(prefix))) return

  const pending = siteWideAds.filter((ad) => ad.enabled && ad.src)
  if (!pending.length) return

  loaded = true

  for (const ad of pending) {
    const script = document.createElement('script')
    script.async = true
    script.dataset.cfasync = 'false'
    script.dataset.ad = ad.name

    // Zone IDs and the like ride on the tag as attributes, and a script reads
    // its own attributes when it runs, so they have to be set before the
    // append below is what starts it.
    for (const [name, value] of Object.entries(ad.attributes ?? {})) {
      script.setAttribute(name, value)
    }

    script.src = ad.src
    document.head.appendChild(script)
  }
}
