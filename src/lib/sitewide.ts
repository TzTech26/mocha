import { siteWideAds } from './ads'

// Loaded once per page load, not once per navigation: these scripts install a
// handler for the whole document, and injecting a second copy on every route
// change is how one click turns into four popunders.
let loaded = false

// Loaded on every page including the proxy viewer, so that the formats which
// render in the top frame - in-page push, interstitials - are there while a
// game or a proxied search is on screen, which is where the time is actually
// spent.
//
// The tradeoff being accepted here: aggressive formats are the fastest way for
// a domain to be noticed by the filters this site exists to get around. If
// this ends up costing more traffic than it earns, the fix is a frequency cap
// in the network dashboard, or excluding `/route/` again here.
export function loadSiteWideAds() {
  if (loaded) return

  const pending = siteWideAds.filter((ad) => ad.src)
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
