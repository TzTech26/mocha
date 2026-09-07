// Ad network configuration.
//
// Google frequently rejects proxy/unblocker sites like Mocha under its "low
// value content" / "screens without publisher-content" policies, no matter
// how much genuine content surrounds the proxy itself - the games, shortcuts
// and bookmarks pages are still mostly navigation UI around other people's
// content. Adsterra is wired in below as a fallback network that accepts this
// site category, so a rejection from one does not mean no ad revenue at all.
// Flip `activeNetwork` once you know which one is actually approved.
// Switching this also means updating the advertising sections of routes/
// terms.tsx and routes/privacy.tsx, which name the network and its cookies
// specifically. A privacy policy describing a network the site is no longer
// using is its own problem.
//
// Keep AdSense Auto ads turned OFF in the dashboard. Auto ads inject units
// wherever the loader script is present, and the loader lives in index.html
// for the whole single page app - including /route/:route, which frames
// proxied third party content. Placements here are explicit for that reason.
export type AdNetwork = 'adsense' | 'adsterra'

export const activeNetwork: AdNetwork = 'adsense'

export const adPlacements = ['games', 'shortcuts', 'bookmarks', 'faq', 'legal', 'about'] as const

export type AdPlacement = (typeof adPlacements)[number]

// --- Google AdSense ---
// Create each unit in AdSense (Ads -> By ad unit -> Display ads) and paste the
// data-ad-slot number it gives you below. A placement with an empty slot ID
// renders nothing at all, so the site never shows a blank ad box for a unit
// that has not been created yet.
export const adClient = 'ca-pub-6942133635007335'

export const adSlots: Record<AdPlacement, string> = {
  games: '',
  shortcuts: '',
  bookmarks: '',
  faq: '',
  legal: '',
  about: ''
}

// --- Adsterra ---
// Create a "Native Banner" unit per placement in the Adsterra dashboard. It
// gives you a snippet with a container <div id="..."> and a loader <script
// src="...">; copy those two values in verbatim below. Unlike AdSense's one
// shared loader, Adsterra issues a distinct script per unit, so it is
// injected next to its container by the Ad component instead of in
// index.html.
export type AdsterraUnit = { containerId: string; scriptSrc: string }

export const adsterraUnits: Record<AdPlacement, AdsterraUnit | null> = {
  games: null,
  shortcuts: null,
  bookmarks: null,
  faq: null,
  legal: null,
  about: null
}

// --- Site wide formats ---
// Popunder and multitag are one script for the whole site rather than one per
// placement, which is why they are here rather than in the Ad component. They
// pay several times what a banner does on this kind of traffic and take one
// pasted URL to install, so this is the shortest path to actual revenue.
//
// An entry with an empty src is skipped, so an unused slot costs nothing and
// the site works fine with none of them filled in.
//
// Where to get each URL:
//   Monetag  - Dashboard -> Sites -> add site -> Multitag -> copy the script src
//   Adsterra - Dashboard -> Websites -> add site -> Popunder -> copy the script src
//
// Both may be run at once; they are separate companies and neither requires
// exclusivity. Two popunders will fire two windows though, so if you add a
// second popunder rather than a multitag, set a frequency cap in at least one
// dashboard first.
export type SiteWideAd = { name: string; src: string }

export const siteWideAds: SiteWideAd[] = [
  { name: 'monetag-multitag', src: '' },
  { name: 'adsterra-popunder', src: '' }
]
