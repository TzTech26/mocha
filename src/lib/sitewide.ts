import { siteWideAds } from './ads'

// Loaded once per page load, not once per navigation: these scripts install a
// handler for the whole document, and injecting a second copy on every route
// change is how one click turns into four popunders.
let loaded = false

// Never loaded on the proxy viewer. A popunder that fires while somebody is
// mid-browse is both the worst possible moment for it and the fastest way for
// this domain to end up on a filter list, which for an unblocker is the one
// failure it cannot come back from. Navigating out of the viewer to any
// ordinary page loads them then.
export function loadSiteWideAds(pathname: string) {
  if (loaded) return
  if (pathname.includes('/route/')) return

  const pending = siteWideAds.filter((ad) => ad.src)
  if (!pending.length) return

  loaded = true

  for (const ad of pending) {
    const script = document.createElement('script')
    script.async = true
    script.dataset.cfasync = 'false'
    script.dataset.ad = ad.name
    script.src = ad.src
    document.head.appendChild(script)
  }
}
